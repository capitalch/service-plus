class SqlAuth:
    GET_ALL_CLIENTS_ON_CRITERIA = """
        with "criteria" as (values(%(criteria)s::text))
        --with "criteria" as (values('cap'::text))
        SELECT id, name, is_active
        FROM client
            where LOWER("name") like LOWER((table "criteria") || '%%')
        ORDER BY name
    """
