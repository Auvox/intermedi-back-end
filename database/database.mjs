import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("./database/intermedi.sqlite");

export default db;
