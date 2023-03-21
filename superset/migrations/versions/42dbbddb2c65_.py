"""Table Hierarcy

Revision ID: 42dbbddb2c65
Revises: 2fcdcb35e487
Create Date: 2017-04-06 11:15:14.716615

"""

# revision identifiers, used by Alembic.
revision = '42dbbddb2c65'
down_revision = '2fcdcb35e487'

import sqlalchemy as sa
from alembic import op


def upgrade():
    op.create_table('table_hier',
                    sa.Column('id', sa.Integer(), nullable=False),
                    sa.Column('hier_name', sa.String(length=256), nullable=True),
                    sa.Column('table_id', sa.Integer(), nullable=True),
                    sa.Column('created_on', sa.DateTime(), nullable=True),
                    sa.Column('changed_on', sa.DateTime(), nullable=True),
                    sa.ForeignKeyConstraint(['table_id'], ['tables.id'], ),
                    sa.PrimaryKeyConstraint('id')
                    )
    op.create_table('table_hier_columns',
                    sa.Column('id', sa.Integer(), nullable=False),
                    sa.Column('hier_id', sa.Integer(), nullable=True),
                    sa.Column('column_id', sa.Integer(), nullable=True),
                    sa.Column('column_order', sa.Integer(), nullable=True),
                    sa.ForeignKeyConstraint(['column_id'], ['table_columns.id'], ),
                    sa.ForeignKeyConstraint(['hier_id'], ['table_hier.id'], ),
                    sa.PrimaryKeyConstraint('id')
                    )


def downgrade():
    op.drop_table('table_hier_columns')
    op.drop_table('table_hier')
