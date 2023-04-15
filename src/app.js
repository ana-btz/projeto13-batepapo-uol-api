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
    const schema = joi.object({ name: joi.string().min(1).required() });
    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) return res.status(422).send(error.details.map(d => d.message));

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
        to: joi.string().min(1).required(),
        text: joi.string().min(1).required(),
        type: joi.valid("message").valid("private_message").required(),
        from: joi.required()
    });

    const { error } = schema.validate({ ...req.body, from: from }, { abortEarly: false });

    if (error) return res.status(422).send(error.details.map(d => d.message));

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

app.get("/messages", async (req, res) => {
    const from = req.headers.user;
    const limit = req.query.limit;

    // Validar query string
    const invalidLimit = limit && (parseInt(limit) <= 0 || isNaN(+limit));

    if (invalidLimit) return res.sendStatus(422);

    try {
        // Buscar menssagens no Banco de dados
        const messages = await db.collection("messages").find({
            $or: [
                { to: { $in: ["Todos", from] } },
                { type: "message" },
                { from: from }
            ]
        }).toArray();

        if (limit) return res.send(messages.reverse().slice(0, parseInt(limit)));

        res.send(messages.reverse());
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post("/status", async (req, res) => {
    const name = req.headers.user;

    if (!name) return res.sendStatus(404);

    try {
        // Verificar se participante consta no BD
        const participantExists = await db.collection("participants").findOne({ name });

        if (!participantExists) return res.sendStatus(404);

        const filter = { name };
        const updateParticipant = {
            $set: {
                lastStatus: Date.now()
            }
        };
        const result = await db.collection("participants").updateOne(filter, updateParticipant);

        res.sendStatus(200);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Remover de usuários inativos
setInterval(removeInactive, 15000);

async function removeInactive() {
    const inactive = Date.now() - 10000;

    try {
        const participants = await db.collection("participants").find({
            lastStatus: { $lt: inactive }
        }).toArray();

        console.log(participants);

        const result = await db.collection("participants").deleteMany({
            lastStatus: { $lt: inactive }
        });

        participants.forEach(async participant => {
            await db.collection("messages").insertOne({
                from: participant.name,
                to: "Todos",
                text: "sai da sala...",
                type: "status",
                time: dayjs().format("HH:mm:ss")
            });
        });

        console.log(`Deleted ${result.deletedCount} documents`)
    } catch (err) {
        console.log(err.message);
    }
}

app.listen(PORT, () => console.log(`Servidor rodando na porta: ${PORT}`));