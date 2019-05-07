# TypeScript Static SQL Sample

An example of an entirely statically typed SQL query library to prevent common coding mistakes.

## Example

```TypeScript
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
```

## Running

    yarn
    yarn start

A sample DB has been provided. Modify `src/index.ts` and have a play around. :-)

## Schema

See `db/schema.sql` for raw schema used in initial creation.

Also, `src/tables.ts` must match the schema exactly.

Eventually, I would to generate the schema and subsequent migrations directly from the TypeScript interfaces.
