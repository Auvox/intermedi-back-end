import { DatabaseSync } from "node:sqlite";


const db = new DatabaseSync(process.env.INTERMEDI_DB_PATH || new URL('./intermedi.sqlite', import.meta.url));

export default db;
