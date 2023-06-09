"""empty message

Revision ID: 1cea9ca185b2
Revises: 373ad5861835
Create Date: 2020-11-18 14:09:03.925599

"""

# revision identifiers, used by Alembic.
revision = '1cea9ca185b2'
down_revision = '373ad5861835'

from alembic import op
import sqlalchemy as sa
from superset import db
from sqlalchemy.dialects import postgresql
from sqlalchemy import engine_from_config
from sqlalchemy.engine import reflection


def _table_has_column(table, column):
    config = op.get_context().config
    engine = engine_from_config(
        config.get_section(config.config_ini_section), prefix='sqlalchemy.')
    insp = reflection.Inspector.from_engine(engine)
    has_column = False
    for col in insp.get_columns(table):
        if column not in col['name']:
            continue
        has_column = True
    return has_column


def upgrade():
    # fix for deadlock when AppBuilder initiated
    db.Session(bind=op.get_bind()).close_all()
    if not _table_has_column('ab_user', 'scope'):
        op.add_column('ab_user', sa.Column('scope', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    op.add_column('table_columns', sa.Column('is_filter_key', sa.Boolean(), nullable=True, server_default='false'))
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    # fix for deadlock when AppBuilder initiated
    db.Session(bind=op.get_bind()).close_all()

    op.drop_column('table_columns', 'is_filter_key')
    if _table_has_column('ab_user', 'scope'):
        op.drop_column('ab_user', 'scope')
