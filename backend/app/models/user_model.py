from datetime import datetime
import sqlalchemy
db = s


class User(db.Model):
    """User model for authentication and profile management"""
    
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    profession = db.Column(db.String(80), unique = False, nullable = False, index = True)
    associated_materials = db.Column(db.JSON, default=list)
    
    
    def __repr__(self):
        return f'<User {self.username}>'
    
    def to_dict(self):
        """Convert user object to dictionary"""
        return {
            'id': self.id,
            'username': self.username,
            'profession' : self.profession,
            'associated_materials': self.associated_materials
        }
