
/// <reference path="../../typings/index.d.ts" />

import { UUID } from '../lib';
import { IUser } from '../Types';

function help() {
  console.log('Template Existing User script for Halcyon');
  console.log('------------------------------');
  console.log('usage: node template-existing-user.js user-uuid template-identifier');
  process.exit(1);
}


if (process.argv.length !== 4) {
  help();
}

import { Config, Validate } from '../Config';
let conf: Config = require('../../settings.js');

let user: string
let template: string

try {
  let u = new UUID(process.argv[2]);
  user = u.toString();
} catch (err) {
  console.log('\ninvalid user uuid\n');
  help();
}

if (!conf.mgm.templates[process.argv[3]]) {
  console.log('\ninvalid template selector\n');
  help();
}

import { getStore, Store } from '../Store';
let store: Store = getStore(conf.mgm.db, conf.halcyon.db);

store.Users.getByID(conf.mgm.templates[process.argv[3]]).then((template: IUser) => {
  return store.Users.getByID(user).then((target: IUser) => {
    console.log('Users located, cloning inventory');
    return store.Users.retemplateUser(target, template);
  });
}).then((u: IUser) => {
  console.log('Templating of ' + u.name() + ' complete');
  process.exit(0);
}).catch((err: Error) => {
  console.log('Error templating user: ' + err.message);
  process.exit(1);
});