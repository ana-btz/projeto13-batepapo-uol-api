import express from "express";
import cors from "cors";
import joi from "joi";
import dayjs from "dayjs";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import customParseFormat from "dayjs/plugin/customParseFormat.js";

const app = express();
const PORT = 5000;

app.use(express.json());
dotenv.config();
app.use(cors());
dayjs.extend(customParseFormat);

// Conectar com Banco de dados
let db;
const mongoClient = new MongoClient(process.env.DATABASE_URL);

mongoClient.connect()
    .then(() => {
        db = mongoClient.db();
        console.log("conectado com o mongo")
    })
    .catch(err => console.log(err.message));

// Requisições
app.post("/participants", async (req, res) => {
    const { name } = req.body;

    // Validar se name é str não vazia
    const schema = joi.object({ name: joi.string().min(1) });
    const { error } = schema.validate({ name });

    if (error) return res.status(422).send(error.details);

    try {
        // Validar se name já não existe
        const nameExists = await db.collection("participants").findOne({ name });

        if (nameExists) return res.sendStatus(409);

        // Salvar participante no Banco de dados
        await db.collection("participants").insertOne({ name, lastStatus: Date.now() });

        // Salvar mensagem no Banco de dados
        const now = dayjs();

        await db.collection("messages").insertOne({
            from: name,
            to: "Todos",
            text: "entra na sala...",
            type: "status",
            time: now.format("HH:mm:ss")
        });

        res.sendStatus(201);

    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get("/participants", async (req, res) => {
    try {
        const participants = await db.collection("participants").find().toArray();
        res.send(participants);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post("/messages", async (req, res) => {
    const { to, text, type } = req.body;
    const from = req.headers.user;

    // Validar dados recebidos
    const schema = joi.object({
        to: joi.string().min(1),
        text: joi.string().min(1),
        type: joi.valid("message").valid("private_message"),
        from: joi.required()
    });

    const { error } = schema.validate({ from, to, text, type });

    if (error) return res.status(422).send(error.details);

    try {
        // Validar se participante existe
        const participantExists = await db.collection("participants").findOne({ name: from });

        if (participantExists === null) res.sendStatus(422);

        // Salvar mensagem no Banco de dados
        await db.collection("messages").insertOne({
            from,
            to,
            text,
            type,
            time: dayjs().format("HH:mm:ss")
        });

        res.sendStatus(201);

    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.listen(PORT, () => console.log(`Servidor rodando na porta: ${PORT}`));