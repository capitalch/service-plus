"""Default division per branch — SQL for plans/plan2.md.

Every branch has exactly one default division (`division.is_default`), named Main (code
`MAIN`) when the system creates it. The flag is written only by the BU seed, the
one-off DEFAULT_DIVISION_DDL script, and the `addBranch` mutation (plan2 Step 2,
resolvers/masters/branches.py), which is also the only way to create a branch.

- `DivisionServerSql` — DDL and server-only SQL. Deliberately NOT in SqlStore, since
  genericQuery runs any SqlStore constant by sqlId.
"""


class DivisionServerSql:
    """Division DDL and server-only SQL. Never composed into SqlStore."""

    # Every BU schema (run with search_path set to it). Safe to run twice. In order:
    # 1-3 add the column, the one-default-per-branch index and the cascading branch FK;
    # 4 marks a default in every branch without one: the division named by
    #   default_division_id if it is in that branch, else the lowest-id active one,
    #   else the lowest-id one;
    # 5 adds Main, copied from the branch, to every branch with no division;
    # 6 retires default_division_id and closes the id gap it leaves in app_setting.
    # No % characters: this runs without parameters.
    DEFAULT_DIVISION_DDL = """
        ALTER TABLE division ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false NOT NULL;

        CREATE UNIQUE INDEX IF NOT EXISTS division_one_default_per_branch
            ON division USING btree (branch_id) WHERE is_default;

        ALTER TABLE division DROP CONSTRAINT IF EXISTS division_branch_id_fkey;
        ALTER TABLE ONLY division
            ADD CONSTRAINT division_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branch(id) ON DELETE CASCADE;

        WITH setting AS (
            SELECT CASE WHEN (setting_value #>> '{}') ~ '^[0-9]+$'
                        THEN (setting_value #>> '{}')::bigint END AS division_id
            FROM app_setting
            WHERE setting_key = 'default_division_id'
        ),
        pick AS (
            SELECT DISTINCT ON (dv.branch_id) dv.id
            FROM division dv
            WHERE NOT EXISTS (SELECT 1 FROM division x WHERE x.branch_id = dv.branch_id AND x.is_default)
            ORDER BY dv.branch_id,
                     (dv.id IS NOT DISTINCT FROM (SELECT division_id FROM setting)) DESC,
                     dv.is_active DESC,
                     dv.id
        )
        UPDATE division d SET is_default = true
        FROM pick
        WHERE d.id = pick.id;

        INSERT INTO division (id, branch_id, code, name, address_line1, address_line2, city, state_id,
                              pincode, phone, email, gstin, is_default)
        SELECT (SELECT COALESCE(MAX(id), 0) FROM division) + row_number() OVER (ORDER BY b.id),
               b.id, 'MAIN', 'Main', b.address_line1, b.address_line2, b.city, b.state_id,
               b.pincode, b.phone, b.email, b.gstin, true
        FROM branch b
        WHERE NOT EXISTS (SELECT 1 FROM division d WHERE d.branch_id = b.id);

        DO $$
        DECLARE
            gap smallint;
            r record;
        BEGIN
            DELETE FROM app_setting WHERE setting_key = 'default_division_id' RETURNING id INTO gap;
            IF gap IS NULL THEN
                RETURN;
            END IF;
            FOR r IN SELECT id FROM app_setting WHERE id > gap ORDER BY id LOOP
                IF NOT EXISTS (SELECT 1 FROM app_setting WHERE id = r.id - 1) THEN
                    UPDATE app_setting SET id = r.id - 1 WHERE id = r.id;
                END IF;
            END LOOP;
        END $$;
    """

    # addBranch: taken inside its transaction before reading MAX(id), so two branches
    # added at once cannot both claim the same division id. Held until commit.
    LOCK_DIVISION_TABLE = """
        LOCK TABLE division IN SHARE ROW EXCLUSIVE MODE
    """

    # addBranch: the new branch's Main, copied from the branch row just inserted.
    INSERT_MAIN_DIVISION_FOR_BRANCH = """
        INSERT INTO division (id, branch_id, code, name, address_line1, address_line2, city, state_id,
                              pincode, phone, email, gstin, is_default)
        SELECT (SELECT COALESCE(MAX(id), 0) + 1 FROM division), b.id, 'MAIN', 'Main', b.address_line1,
               b.address_line2, b.city, b.state_id, b.pincode, b.phone, b.email, b.gstin, true
        FROM branch b
        WHERE b.id = %(branch_id)s
        RETURNING id
    """

    # genericUpdate guard: which of these division ids are a branch's default.
    GET_DEFAULT_DIVISION_IDS = """
        SELECT id FROM division WHERE id = ANY(%(ids)s) AND is_default
    """

    # Report, per branch, the default division after the script ran (runner output).
    GET_BRANCH_DEFAULTS = """
        SELECT b.code AS branch_code, d.id AS division_id, d.code AS division_code
        FROM branch b
        LEFT JOIN division d ON d.branch_id = b.id AND d.is_default
        ORDER BY b.id
    """
