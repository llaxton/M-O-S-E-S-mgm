
import { IPool } from 'mysql';
import { PendingUser } from '.';

export interface PendingUser {
  name: string
  email: string
  gender: string
  password: string
  registered: string
  summary: string
}

interface pending_user_row {
  name: string
  email: string
  gender: string
  password: string
  registered: string
  summary: string
}

export class PendingUsers {
  private db: IPool

  constructor(db: IPool) {
    this.db = db;
  }

  getAll(): Promise<PendingUser[]> {
    return new Promise<PendingUser[]>((resolve, reject) => {
      this.db.query('SELECT * FROM users', (err, rows: pending_user_row[]) => {
        if (err) return reject(err);
        resolve(rows);
      })
    });
  }

  /*
  getByName(name: string): Promise<PendingUser> {
    return this.db.findOne({
      where: {
        Name: name
      }
    });
  }

  create(name: string, email: string, template: string, credential: Credential, summary: string): Promise<PendingUserInstance> {
    return this.db.create({
      name: name,
      email: email,
      gender: template,
      password: credential.hash,
      summary: summary
    });
  }
  */
}