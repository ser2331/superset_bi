"""postgis_extension

Revision ID: 8efc2c50933d
Revises: 346hs5dbqw23
Create Date: 2022-08-29 12:57:46.094165

"""

# revision identifiers, used by Alembic.
from superset import db

revision = '8efc2c50933d'
down_revision = '346hs5dbqw23'

from alembic import op
import sqlalchemy as sa


def upgrade():
    db.engine.execute('CREATE EXTENSION IF NOT EXISTS postgis;')


def downgrade():
    db.engine.execute('DROP EXTENSION IF EXISTS postgis;')
