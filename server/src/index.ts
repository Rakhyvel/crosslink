import express from "express";
import cors from "cors";
import { Serialized } from "shared";
import Database from "better-sqlite3";

const app = express();
app.use(cors());
app.use(express.json());

const db = new Database("components.db");
db.exec(`
CREATE TABLE IF NOT EXISTS components (
    user TEXT NOT NULL,
    name TEXT NOT NULL,
    data TEXT NOT NULL,
    PRIMARY KEY (user, name)
)
`);

app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
});

app.get("/api/components", (req, res) => {
    const user = req.query.user as string

    if (!user) {
        return res.status(400).json({ error: "Missing user" })
    }

    type ComponentRow = {
        name: string
        data: string
    }

    const rows = db
        .prepare<[string], ComponentRow>("SELECT name, data FROM components WHERE user = ?")
        .all(user);

    const result: Record<string, Serialized> = {};

    for (const row of rows) {
        result[row.name] = JSON.parse(row.data)
    }

    res.json(result);
});

app.post("/api/components", (req, res) => {
    const user = req.query.user as string;
    const { name, data } = req.body;

    if (!user) {
        return res.status(400).json({ error: "Missing user" });
    }

    if (!name || !data) {
        return res.status(400).json({ error: "Missing name or data" });
    }

    db.prepare(`
        INSERT INTO components (user, name, data)
        VALUES (?, ?, ?)
        ON CONFLICT(user, name)
        DO UPDATE SET data = excluded.data
    `).run(user, name, JSON.stringify(data));

    res.json({ success: true });
});

app.delete("/api/components", (req, res) => {
    const user = req.query.user as string;
    const { name } = req.body;

    if (!user) {
        return res.status(400).json({ error: "Missing user" });
    }

    if (!name) {
        return res.status(400).json({ error: "Missing component name" });
    }

    const result = db
        .prepare("DELETE FROM components WHERE user = ? AND name = ?")
        .run(user, name);

    if (result.changes === 0) {
        return res.status(404).json({ error: "Component not found" });
    }

    res.json({ success: true });
});

app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});