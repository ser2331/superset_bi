"""empty message

Revision ID: c7d301afb8bc
Revises: 3761cc38ad6c
Create Date: 2020-04-29 19:33:09.410230

"""

# revision identifiers, used by Alembic.
revision = 'c7d301afb8bc'
down_revision = '3761cc38ad6c'

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

def upgrade():
    # ### commands auto generated by Alembic - ADJUSTED ###
    # op.add_column('table_columns', sa.Column('auto_upd_verbose_name', sa.Boolean(), nullable=False, default=False))
    # Would like so? Well, it does not work! WTF, Alembic?
    # Thx to https://medium.com/the-andela-way/alembic-how-to-add-a-non-nullable-field-to-a-populated-table-998554003134
    op.add_column('table_columns', sa.Column('auto_upd_verbose_name', sa.Boolean(), nullable=True))
    op.execute('UPDATE table_columns SET auto_upd_verbose_name = true')
    op.alter_column('table_columns', 'auto_upd_verbose_name', nullable=False)
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - ADJUSTED ###
    op.drop_column('table_columns', 'auto_upd_verbose_name')
    # ### end Alembic commands ###
