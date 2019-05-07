import Knex = require('knex');
import { fromTable, insertIntoTable } from './query';

const knex = Knex({
  client: 'sqlite3',
  connection: {
    filename: './db/db.sqlite',
  },
  useNullAsDefault: true,
});

async function test0() {
  const category = await insertIntoTable(knex, 'category', {
    name: `Category - ${Date.now()}`,
  });

  console.log('Added:', category);

  const product = await insertIntoTable(knex, 'product', {
    category_id: category.id,
    name: `Product - ${Date.now()}`,
    price: (Math.random() * 200) | 0,
  });

  console.log('Added:', product);
}

async function test1() {
  const rows = await fromTable(knex, 'product')
    .join('category', ['root', 'category_id'], ['cat', 'id'])
    .where(['root', 'name'], 'Product - 1557263849739')
    .where(['cat', 'name'], 'Category - 1557263849688')
    .match([['root', 'price'], '>', 100])
    .joinSelect(['root', 'id', 'name', 'price' /*,'description'*/], ['cat', 'name'])
    .get();

  if (rows.items.length === 0) return;

  const firstRow = rows.items[0];

  const product = firstRow.root;
  const cat = firstRow.cat;

  // Can use the properties we selected....
  console.log('Product and Category join:', product.name, product.price, cat.name);

  // ERROR: Can't use this prop because we haven't selected it!
  // console.log(product.description);
}

async function test2() {
  const rows = await fromTable(knex, 'product')
    .where(['root', 'name'], 'Product - 1557263849739')
    .match([['root', 'price'], '>', 100])
    .select('*')
    .get();

  if (rows.items.length === 0) return;

  const product = rows.items[0];

  // Can access all properties because we used '*'
  console.log('Product select ALL:', product.name, product.price, product.description);
}

async function run() {
  // await test0();   // Used to generate test data...
  await test1();
  await test2();

  process.exit();
}

run();
