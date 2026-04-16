-- ============================================================
-- stock_opening_balance         (header)
-- stock_opening_balance_line    (lines)
-- Schema: demo1
--
-- Modelled after stock_adjustment / stock_adjustment_line.
-- Records the one-time opening stock at software go-live.
-- dr_cr is always 'D' (stock IN) — no check needed on header.
-- ============================================================


-- ============================================================
-- 1. stock_opening_balance  (header)
-- ============================================================

CREATE TABLE demo1.stock_opening_balance (
    id           bigint NOT NULL,
    entry_date   date NOT NULL,
    ref_no       text,
    branch_id    bigint NOT NULL,
    remarks      text,
    created_by   bigint,
    created_at   timestamp with time zone DEFAULT now() NOT NULL,
    updated_at   timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE demo1.stock_opening_balance OWNER TO webadmin;

COMMENT ON COLUMN demo1.stock_opening_balance.created_by IS 'Loosely coupled to user table - no FK constraint';

ALTER TABLE demo1.stock_opening_balance ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME demo1.stock_opening_balance_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


-- ============================================================
-- 2. stock_opening_balance_line  (lines)
-- ============================================================

CREATE TABLE demo1.stock_opening_balance_line (
    id                       bigint NOT NULL,
    stock_opening_balance_id bigint NOT NULL,
    part_id                  bigint NOT NULL,
    qty                      numeric(12,3) NOT NULL,
    unit_cost                numeric(12,2),
    remarks                  text,
    created_at               timestamp with time zone DEFAULT now() NOT NULL,
    updated_at               timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stock_opening_balance_line_qty_check CHECK ((qty > (0)::numeric))
);

ALTER TABLE demo1.stock_opening_balance_line OWNER TO webadmin;

ALTER TABLE demo1.stock_opening_balance_line ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME demo1.stock_opening_balance_line_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


-- ============================================================
-- 3. Primary keys
-- ============================================================

ALTER TABLE ONLY demo1.stock_opening_balance
    ADD CONSTRAINT stock_opening_balance_pkey PRIMARY KEY (id);

ALTER TABLE ONLY demo1.stock_opening_balance_line
    ADD CONSTRAINT stock_opening_balance_line_pkey PRIMARY KEY (id);


-- ============================================================
-- 4. Indexes
-- ============================================================

CREATE INDEX idx_stock_ob_date    ON demo1.stock_opening_balance      USING btree (entry_date);
CREATE INDEX idx_stock_ob_branch  ON demo1.stock_opening_balance      USING btree (branch_id);

CREATE INDEX idx_stock_ob_line_ob_id ON demo1.stock_opening_balance_line USING btree (stock_opening_balance_id);
CREATE INDEX idx_stock_ob_line_part  ON demo1.stock_opening_balance_line USING btree (part_id);


-- ============================================================
-- 5. Foreign keys
-- ============================================================

ALTER TABLE ONLY demo1.stock_opening_balance
    ADD CONSTRAINT stock_opening_balance_branch_fk
        FOREIGN KEY (branch_id) REFERENCES demo1.branch(id) ON DELETE RESTRICT;

ALTER TABLE ONLY demo1.stock_opening_balance_line
    ADD CONSTRAINT stock_opening_balance_line_ob_fk
        FOREIGN KEY (stock_opening_balance_id) REFERENCES demo1.stock_opening_balance(id) ON DELETE CASCADE;

ALTER TABLE ONLY demo1.stock_opening_balance_line
    ADD CONSTRAINT stock_opening_balance_line_spare_part_fk
        FOREIGN KEY (part_id) REFERENCES demo1.spare_part_master(id) ON DELETE RESTRICT;
