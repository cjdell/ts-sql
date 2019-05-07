import * as Knex from 'knex';
import { Omit } from 'ts-essentials';
import { Schema, SchemaStructure } from './tables';

export interface Paging {
  take: number;
  skip: number;
}

export interface Result<T> {
  totalCount: number;
  items: ReadonlyArray<T>;
}

interface Dictionary<T> {
  [index: string]: T;
}

export function fromTable<TTableName extends keyof Schema, TTable extends Schema[TTableName]>(knex: Knex, tableName: TTableName) {
  const q = knex(`${tableName} as root`);

  const rec: Record<'root', TTableName> = { 'root': tableName };

  return where<typeof rec, TTable>(q, rec);
}

export async function insertIntoTable<TTableName extends keyof Schema, TTable extends Schema[TTableName]>(knex: Knex, tableName: TTableName, row: Omit<TTable, 'id'>) {
  const q = knex(tableName);

  // NOTE: Different DB's work differently in how they return their auto-increment keys...
  const res = await q.insert(row);

  return { ...row, id: res[0] as number };
}

export function freezeResults<T>(arr: T[]): ReadonlyArray<Readonly<T>> {
  return Object.freeze(arr.map((elem) => Object.freeze(elem)));
}

export function assertUnreachable(x: never): never {
  throw new Error(`An unreachable event has occurred: ${x}`);
}

function where<TTableAlias extends Record<string, keyof Schema>,
  TTable extends Schema[TTableAlias[string]],
  >(q: Knex.QueryBuilder, tableAlias: TTableAlias): Query<Extract<keyof TTableAlias, string>, TTable, TTableAlias> {

  return {
    join: (joinTableName, col, joinCol) => {
      q.join(`${joinTableName} as ${joinCol[0]}`, function () {
        this.on(columnRef(col), columnRef(joinCol));
      });

      const joinTableAlias = { [joinCol[0]]: joinTableName };

      return where(q, { ...tableAlias, ...joinTableAlias });
    },

    select: (...cols) => {
      return {
        get: async (paging, map) => {
          const countChain = q.clone();
          (countChain as any)._clearGrouping('order');
          const [{ count }] = await countChain.count(columnRef(['root', 'id'])).as('count');

          // If selecting everything, avoid selecting the `id` columns from joined tables...
          if (cols[0] === '*') {
            const colNames = Object.keys(SchemaStructure[tableAlias.root]);

            let selectList = colNames.map((col) => (`root.${col}`));

            for (const key in tableAlias) {
              const otherColNames = Object.keys(SchemaStructure[tableAlias[key]]);

              selectList = [...selectList, ...otherColNames.filter((col) => col !== 'id').map((col) => (`${key}.${col}`))];
            }

            q.select(selectList);
          } else {
            q.select(cols);
          }

          if (paging) {
            q.offset(paging.skip).limit(paging.take);
          }

          const sql = q.toSQL();
          console.log('GENERATED SQL:', sql.sql, sql.bindings);

          const rows = (await q);

          if (!map) map = (row) => row as any;

          const result: Result<any> = {
            totalCount: parseInt(count, 10),
            items: freezeResults(rows.map(map)),
          };

          return result;
        },
      };
    },

    joinSelect: (colsA, colsB, colsC, colsD) => {
      return {
        get: async (paging, map) => {
          const countChain = q.clone();
          (countChain as any)._clearGrouping('order');
          const [{ count }] = await countChain.count(columnRef(['root', 'id'])).as('count');

          let cols: string[] = [];

          const [aliasA, ...colsNamesA] = colsA;
          const nColsNamesA: string[] = (colsNamesA[0] !== '*') ? colsNamesA : Object.keys(SchemaStructure[tableAlias[aliasA]]);
          cols = [...cols, ...nColsNamesA.map((col) => `${aliasA}.${col} as ${aliasA}_${col}`)];

          const [aliasB, ...colsNamesB] = colsB;
          const nColsNamesB: string[] = (colsNamesB[0] !== '*') ? colsNamesB : Object.keys(SchemaStructure[tableAlias[aliasB]]);
          cols = [...cols, ...nColsNamesB.map((col) => `${aliasB}.${col} as ${aliasB}_${col}`)];

          let nColsNamesC: string[] = [];
          let aliasC: string;

          if (colsC) {
            const [_aliasC, ...colsNamesC] = colsC;
            aliasC = String(_aliasC);
            nColsNamesC = (colsNamesC[0] !== '*') ? colsNamesC : Object.keys(SchemaStructure[tableAlias[aliasC]]);
            cols = [...cols, ...nColsNamesC.map((col) => `${aliasC}.${col} as ${aliasC}_${col}`)];
          }

          let nColsNamesD: string[] = [];
          let aliasD: string;

          if (colsD) {
            const [_aliasD, ...colsNamesD] = colsD;
            aliasD = String(_aliasD);
            nColsNamesD = (colsNamesD[0] !== '*') ? colsNamesD : Object.keys(SchemaStructure[tableAlias[aliasD]]);
            cols = [...cols, ...nColsNamesD.map((col) => `${aliasD}.${col} as ${aliasD}_${col}`)];
          }

          q.select(cols);

          if (paging) {
            q.offset(paging.skip).limit(paging.take);
          }

          const sql = q.toSQL();
          console.log('GENERATED SQL:', sql.sql, sql.bindings);

          const rowsRaw: Dictionary<KnexValue>[] = (await q);

          const rows = rowsRaw.map((row) => {
            const item: any = {};

            const partA: Dictionary<KnexValue> = {};
            nColsNamesA.forEach((col) => partA[col] = row[`${aliasA}_${col}`]);
            item[aliasA] = partA;

            const partB: Dictionary<KnexValue> = {};
            nColsNamesB.forEach((col) => partB[col] = row[`${aliasB}_${col}`]);
            item[aliasB] = partB;

            if (colsC) {
              const partC: Dictionary<KnexValue> = {};
              nColsNamesC.forEach((col) => partC[col] = row[`${aliasC}_${col}`]);
              item[aliasC] = partC;
            }

            if (colsD) {
              const partD: Dictionary<KnexValue> = {};
              nColsNamesD.forEach((col) => partD[col] = row[`${aliasD}_${col}`]);
              item[aliasD] = partD;
            }

            return item;
          });

          if (!map) map = (row) => row as any;

          const result: Result<any> = {
            totalCount: parseInt(count, 10),
            items: freezeResults(rows.map(map)),
          };

          return result;
        },
      };
    },

    where: (col, val) => {
      q.where(columnRef(col), val);

      return where<TTableAlias, TTable>(q, tableAlias);
    },

    match: (m) => {
      if (m[1] === '=') {
        q.where(columnRef(m[0]), m[2]);
      } else if (m[1] === '!=') {
        q.whereNot(columnRef(m[0]), m[2]);
      } else if (m[1] === '<' || m[1] === '>' || m[1] === '<=' || m[1] === '>=') {
        q.where(columnRef(m[0]), m[1], m[2]);
      } else if (m[1] === 'in') {
        q.whereIn(columnRef(m[0]), m[2].slice(0));
      } else if (m[1] === 'is') {
        q.whereNull(columnRef(m[0]));
      } else if (m[1] === 'range') {
        q.whereBetween(columnRef(m[0]), m[2]);
      } else {
        assertUnreachable(m[1]);
      }

      return where<TTableAlias, TTable>(q, tableAlias);
    },

    order: (col, dir) => {
      q.orderBy(columnRef(col), dir);

      return where<TTableAlias, TTable>(q, tableAlias);
    },

    update: async (update) => {
      await q.update(update);
    },

    delete: async () => {
      await q.del();
    },
  };

}

function columnRef(col: [string, string]) {
  return `${col[0]}.${col[1]}`;
}

type KnexValue = string | number | boolean | Date | Array<string> | Array<number> | Array<Date> | Array<boolean>;

type Match<
  TWAlias extends string,
  TTable,
  TColumn extends keyof TTable,
  TValue = TTable[TColumn] extends (KnexValue | null) ? TTable[TColumn] : never,
  > = (
    MatchEq<TWAlias, TColumn, TValue> |
    MatchNotEq<TWAlias, TColumn, TValue> |
    MatchLtGt<TWAlias, TColumn, Extract<TValue, number | string>> |
    MatchIn<TWAlias, TColumn, TValue> |
    MatchIs<TWAlias, TColumn, Extract<TValue, null>> |
    (TValue extends number ? MatchRange<TWAlias, TColumn, number, number> : never)
  );

type MatchEq<TWAlias, TWCol, TValue> = [
  [TWAlias, TWCol],
  '=',
  Extract<TValue, KnexValue>
];

type MatchNotEq<TWAlias, TWCol, TValue> = [
  [TWAlias, TWCol],
  '!=',
  Extract<TValue, KnexValue>
];

type MatchLtGt<TWAlias, TWCol, TValue> = [
  [TWAlias, TWCol],
  '>' | '<' | '>=' | '<=',
  Extract<TValue, number | string>
];

type MatchIn<TWAlias, TWCol, TValue> = [
  [TWAlias, TWCol],
  'in',
  ReadonlyArray<Extract<TValue, KnexValue>>
];

type MatchIs<TWAlias, TWCol, TValue extends null> = [
  [TWAlias, TWCol],
  'is',
  TValue
];

type MatchRange<TWAlias, TWCol, TValue1 extends number, TValue2 extends number> = [
  [TWAlias, TWCol],
  'range',
  [TValue1, TValue2]
];

export type Query<TAlias extends string, TTable extends Schema[TTableAlias[TAlias]], TTableAlias extends Record<TAlias | 'root', keyof Schema>> = {
  join: <TJoinTableAlias extends Record<TJoinAlias, TJoinTableName>,
    TWAlias extends Extract<keyof TTableAlias, string>,
    TWTableName extends TTableAlias[TWAlias],
    TWCol extends Extract<keyof Schema[TWTableName], string>,
    TJoinAlias extends string,
    TJoinTableName extends keyof Schema,
    TJoinTable extends Schema[TJoinTableName],
    >(joinTableName: TJoinTableName, col: [TWAlias, TWCol], joinCol: [TJoinAlias, Extract<keyof TJoinTable, string>]) => Query<TAlias | TJoinAlias, TTable & TJoinTable, TTableAlias & TJoinTableAlias>,

  select: <TSTable extends TTable,
    TColumn extends Extract<keyof TSTable, string> | '*',
    >(...cols: TColumn[]) => {
      get: <TRow extends Pick<TSTable, TColumn extends '*' ? keyof TSTable : TColumn>,
        TItem = TRow,
        >(paging?: Paging, map?: (row: TRow) => TItem) => Promise<Result<TItem>>,
    },

  joinSelect: <TAliasA extends keyof TTableAlias,
    TTableA extends Schema[TTableAlias[TAliasA]],
    TColA extends Extract<keyof Schema[TTableAlias[TAliasA]], string> | '*',
    TColumnsA extends Pick<TTableA, (TColA extends keyof TTableA ? TColA : keyof TTableA)>,

    TAliasB extends keyof TTableAlias,
    TTableB extends Schema[TTableAlias[TAliasB]],
    TColB extends Extract<keyof Schema[TTableAlias[TAliasB]], string> | '*',
    TColumnsB extends Pick<TTableB, (TColB extends keyof TTableB ? TColB : keyof TTableB)>,

    TAliasC extends keyof TTableAlias,
    TTableC extends Schema[TTableAlias[TAliasC]],
    TColC extends Extract<keyof Schema[TTableAlias[TAliasC]], string> | '*',
    TColumnsC extends Pick<TTableC, (TColC extends keyof TTableC ? TColC : keyof TTableC)>,

    TAliasD extends keyof TTableAlias,
    TTableD extends Schema[TTableAlias[TAliasD]],
    TColD extends Extract<keyof Schema[TTableAlias[TAliasD]], string> | '*',
    TColumnsD extends Pick<TTableD, (TColD extends keyof TTableD ? TColD : keyof TTableD)>,

    >(colsA: [TAliasA, ...TColA[]], colsB: [TAliasB, ...TColB[]], colsC?: [TAliasC, ...TColC[]], colsD?: [TAliasD, ...TColD[]]) => {
      get: <TRow extends Record<TAliasA, TColumnsA> & Record<TAliasB, TColumnsB> & (TAliasC extends string ? Record<TAliasC, TColumnsC> : {}) & (TAliasD extends string ? Record<TAliasD, TColumnsD> : {}),
        TItem = TRow,
        >(paging?: Paging, map?: (row: TRow) => TItem) => Promise<Result<TItem>>,
    },

  where: <TWAlias extends Extract<keyof TTableAlias, string>,
    TWTableName extends TTableAlias[TWAlias],
    TWCol extends Extract<keyof Schema[TWTableName], string>,
    TWVal extends Extract<Schema[TWTableName][TWCol], KnexValue>
    >(col: [TWAlias, TWCol], val: TWVal) => Query<TAlias, TTable, TTableAlias>,

  match: <TWAlias extends Extract<keyof TTableAlias, string>,
    TWTableName extends TTableAlias[TWAlias],
    TWCol extends Extract<keyof Schema[TWTableName], string>,
    TWVal extends Extract<Schema[TWTableName][TWCol], KnexValue | null>
    >(m: Match<TWAlias, Schema[TWTableName], TWCol, TWVal>) => Query<TAlias, TTable, TTableAlias>,

  order: <TWAlias extends Extract<keyof TTableAlias, string>,
    TWTableName extends TTableAlias[TWAlias],
    TWCol extends Extract<keyof Schema[TWTableName], string>
    >(col: [TWAlias, TWCol], dir: 'asc' | 'desc') => Query<TAlias, TTable, TTableAlias>,

  update: (update: Partial<Schema[TTableAlias['root']]>) => Promise<void>,

  delete: () => Promise<void>,
};
