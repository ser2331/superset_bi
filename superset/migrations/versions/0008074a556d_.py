"""empty message

Revision ID: 0008074a556d
Revises: 42dbbddb2c65
Create Date: 2017-05-29 15:03:02.182661

"""

# revision identifiers, used by Alembic.
revision = '0008074a556d'
down_revision = '42dbbddb2c65'

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('metric_complex_aggregations',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('hier_id', sa.Integer(), nullable=True),
    sa.Column('metric_id', sa.Integer(), nullable=True),
    sa.Column('order', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['hier_id'], ['table_hier.id'], ),
    sa.ForeignKeyConstraint(['metric_id'], ['sql_metrics.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('metric_complex_aggregations')
    # ### end Alembic commands ###