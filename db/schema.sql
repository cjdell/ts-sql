CREATE TABLE product (
  id          INTEGER   PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER   NOT NULL,
  name        TEXT      NOT NULL,
  description TEXT      NULL,
  price       INTEGER   NOT NULL
);

CREATE TABLE category (
  id          INTEGER   PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL
);
