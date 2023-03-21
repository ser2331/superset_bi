"""empty message

Revision ID: 9857d55fa129
Revises: 2ad905892e34
Create Date: 2018-10-07 23:41:35.221584

"""

# revision identifiers, used by Alembic.
revision = '9857d55fa129'
down_revision = '2ad905892e34'

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('saved_query', sa.Column('for_iam', sa.Boolean(), nullable=True))
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('saved_query', 'for_iam')
    # ### end Alembic commands ###