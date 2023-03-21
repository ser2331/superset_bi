"""empty message

Revision ID: 43b9b945a956
Revises: 2863a0ab51af
Create Date: 2022-01-30 08:27:03.647539

"""

# revision identifiers, used by Alembic.
revision = '43b9b945a956'
down_revision = '2863a0ab51af'

from alembic import op
import sqlalchemy as sa


# TODO reuse after all migrations if the project is ran for the first time
def upgrade():
    conn = op.get_bind()
    conn.execute(sa.text('ALTER TABLE if exists long_lat RENAME COLUMN "LON" to lon'))
    conn.execute(sa.text('ALTER TABLE if exists long_lat RENAME COLUMN "LAT" to lat'))
    conn.execute(sa.text('ALTER TABLE if exists long_lat RENAME COLUMN "NUMBER" to number'))
    conn.execute(sa.text('ALTER TABLE if exists long_lat RENAME COLUMN "STREET" to street'))
    conn.execute(sa.text('ALTER TABLE if exists long_lat RENAME COLUMN "UNIT" to unit'))
    conn.execute(sa.text('ALTER TABLE if exists long_lat RENAME COLUMN "CITY" to city'))
    conn.execute(sa.text('ALTER TABLE if exists long_lat RENAME COLUMN "DISTRICT" to district'))
    conn.execute(sa.text('ALTER TABLE if exists long_lat RENAME COLUMN "REGION" to region'))
    conn.execute(sa.text('ALTER TABLE if exists long_lat RENAME COLUMN "POSTCODE" to postcode'))
    conn.execute(sa.text('ALTER TABLE if exists long_lat RENAME COLUMN "ID" to id'))
    conn.execute(
        "update table_columns  set column_name=lower(column_name)  "
        "where table_id= (select id from tables where table_name='long_lat') "
        "and column_name in ('LON', 'LAT', 'NUMBER', 'STREET', 'UNIT', 'CITY', 'DISTRICT','REGION', 'POSTCODE', 'ID')")

    conn.execute(sa.text(
        "update sql_metrics set metric_name=CASE when metric_name like '%LON%' THEN replace(metric_name, 'LON', 'lon') "
        "when metric_name like '%LAT%' THEN replace(metric_name, 'LAT', 'lat') when metric_name "
        "like '%NUMBER%' THEN replace(metric_name, 'NUMBER', 'number') when metric_name like '%STREET%' "
        "THEN replace(metric_name, 'STREET', 'street') when metric_name like '%UNIT%' "
        "THEN replace(metric_name, 'UNIT', 'unit') when metric_name like '%CITY%' "
        "THEN replace(metric_name, 'CITY', 'city') when metric_name like '%DISTRICT%' "
        "THEN replace(metric_name, 'DISTRICT', 'district') when metric_name like '%REGION%' "
        "THEN replace(metric_name, 'REGION', 'region') when metric_name like '%POSTCODE%' "
        "THEN replace(metric_name, 'POSTCODE', 'postcode') when metric_name like '%ID%' "
        "THEN replace(metric_name, 'ID', 'id') END,"
        "expression= CASE when metric_name like '%LON%' THEN replace(metric_name, 'LON', 'lon') "
        "when metric_name like '%LAT%' THEN replace(metric_name, 'LAT', 'lat') when metric_name "
        "like '%NUMBER%' THEN replace(metric_name, 'NUMBER', 'number') when metric_name like '%STREET%' "
        "THEN replace(metric_name, 'STREET', 'street') when metric_name like '%UNIT%' "
        "THEN replace(metric_name, 'UNIT', 'unit') when metric_name like '%CITY%' "
        "THEN replace(metric_name, 'CITY', 'city') when metric_name like '%DISTRICT%' "
        "THEN replace(metric_name, 'DISTRICT', 'district') when metric_name like '%REGION%' "
        "THEN replace(metric_name, 'REGION', 'region') when metric_name like '%POSTCODE%' "
        "THEN replace(metric_name, 'POSTCODE', 'postcode') when metric_name like '%ID%' "
        "THEN replace(metric_name, 'ID', 'id') END "
        "where table_id = (select id from tables where table_name='long_lat') "
        "and (metric_name like '%LON%' or metric_name like '%LAT%' or metric_name like '%NUMBER%' or metric_name "
        "like '%STREET%' or metric_name like '%UNIT%' or metric_name like '%CITY%' or metric_name like '%DISTRICT%' "
        "or metric_name like '%REGION%' or metric_name like '%POSTCODE%' or metric_name like '%ID%')"))

    conn.execute(sa.text(
        '''update slices set params=CASE when params like '%"LON"%' THEN replace(params, '"LON"', '"lon"') ELSE params '''
        '''END '''
        '''where datasource_id = (select id from tables where table_name='long_lat')'''))

    conn.execute(sa.text(
        '''update slices set params=CASE when params like '%"LAT"%' THEN replace(params, '"LAT"', '"lat"') ELSE params '''
        '''END '''
        '''where datasource_id = (select id from tables where table_name='long_lat')'''))


def downgrade():
    pass
    # op.alter_column('long_lat', 'lon', new_column_name='LON')
    # op.alter_column('long_lat', 'lat', new_column_name='LAT')
    # op.alter_column('long_lat', 'number', new_column_name='NUMBER')
    # op.alter_column('long_lat', 'street', new_column_name='STREET')
    # op.alter_column('long_lat', 'unit', new_column_name='UNIT')
    # op.alter_column('long_lat', 'city', new_column_name='CITY')
    # op.alter_column('long_lat', 'district', new_column_name='DISTRICT')
    # op.alter_column('long_lat', 'region', new_column_name='REGION')
    # op.alter_column('long_lat', 'postcode', new_column_name='POSTCODE')
    # op.alter_column('long_lat', 'id', new_column_name='ID')
    # conn = op.get_bind()
    # conn.execute(
    #     "update table_columns set column_name=upper(column_name)  "
    #     "where table_id= (select id from tables where table_name='long_lat') "
    #     "and column_name in ('lon', 'lat', 'number', 'street', 'unit', 'city', 'district','region', 'postcode', 'id')")
    #
    # conn.execute(sa.text(
    #     "update sql_metrics set metric_name=CASE when metric_name like '%lon%' THEN replace(metric_name, 'lon', 'LON') "
    #     "when metric_name like '%lat%' THEN replace(metric_name, 'lat', 'LAT') when metric_name "
    #     "like '%number%' THEN replace(metric_name, 'number', 'NUMBER') when metric_name like '%street%' "
    #     "THEN replace(metric_name, 'street', 'STREET') when metric_name like '%unit%' "
    #     "THEN replace(metric_name, 'unit', 'UNIT') when metric_name like '%city%' "
    #     "THEN replace(metric_name, 'city', 'CITY') when metric_name like '%district%' "
    #     "THEN replace(metric_name, 'district', 'DISTRICT') when metric_name like '%region%' "
    #     "THEN replace(metric_name, 'region', 'REGION') when metric_name like '%postcode%' "
    #     "THEN replace(metric_name, 'postcode', 'POSTCODE') when metric_name like '%id%' "
    #     "THEN replace(metric_name, 'id', 'ID') END,"
    #     "expression= CASE when metric_name like '%lon%' THEN replace(metric_name, 'lon', 'LON') "
    #     "when metric_name like '%lat%' THEN replace(metric_name, 'lat', 'LAT') when metric_name "
    #     "like '%number%' THEN replace(metric_name, 'number', 'NUMBER') when metric_name like '%street%' "
    #     "THEN replace(metric_name, 'street', 'STREET') when metric_name like '%unit%' "
    #     "THEN replace(metric_name, 'unit', 'UNIT') when metric_name like '%city%' "
    #     "THEN replace(metric_name, 'city', 'CITY') when metric_name like '%district%' "
    #     "THEN replace(metric_name, 'district', 'DISTRICT') when metric_name like '%region%' "
    #     "THEN replace(metric_name, 'region', 'REGION') when metric_name like '%postcode%' "
    #     "THEN replace(metric_name, 'postcode', 'POSTCODE') when metric_name like '%id%' "
    #     "THEN replace(metric_name, 'id', 'ID') END "
    #     "where table_id = (select id from tables where table_name='long_lat') "
    #     "and (metric_name like '%lon%' or metric_name like '%lat%' or metric_name like '%number%' or metric_name "
    #     "like '%street%' or metric_name like '%unit%' or metric_name like '%city%' or metric_name like '%district%' "
    #     "or metric_name like '%region%' or metric_name like '%postcode%' or metric_name like '%id%')"))
    #
    # conn.execute(sa.text(
    #     '''update slices set params=CASE when params like '%"lon"%' THEN replace(params, '"lon"', '"LON"') ELSE params '''
    #     '''END '''
    #     '''where datasource_id = (select id from tables where table_name='long_lat')'''))
    #
    # conn.execute(sa.text(
    #     '''update slices set params=CASE when params like '%"lat"%' THEN replace(params, '"lat"', '"LAT"') ELSE params '''
    #     '''END '''
    #     '''where datasource_id = (select id from tables where table_name='long_lat')'''))
