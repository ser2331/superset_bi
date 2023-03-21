"""add

Revision ID: 346hs5dbqw23
Revises: 43b9b945a956
Create Date: 2022-07-27 19:40:39.763066

"""

# revision identifiers, used by Alembic.
revision = '346hs5dbqw23'
down_revision = '43b9b945a956'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.create_table(
        'geo_poligons',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column('content', sa.JSON(), nullable=False)
    )
    # ### end Alembic commands ###

def downgrade():
    op.drop_table('geo_poligons')
    # ### end Alembic commands ###
