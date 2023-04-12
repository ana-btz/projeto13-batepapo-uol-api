import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { MongoClient } from "mongodb";

dotenv.config();

const app = express();
const PORT = 5000;

app.use(cors);
app.use(express.json());

// Conectar com DB
let db;
const mongoClient = new MongoClient(process.env.DATABASE_URL);

mongoClient.connect()
    .then(() => db = mongoClient.db())
    .catch(err => console.log(err.message));

app.listen(PORT, () => console.log(`Servidor rodando na porta: ${PORT}`));