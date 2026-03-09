import express from "express";
import cors from "cors";
import { Serialized } from "shared";

const app = express();
app.use(cors());
app.use(express.json());

const componentsByUser = new Map<string, Map<string, Serialized>>();

app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
});

app.get("/api/components", (req, res) => {
    const user = req.query.user as string

    if (!user) {
        return res.status(400).json({ error: "Missing user" })
    }

    const userComponents = componentsByUser.get(user)

    if (!userComponents) {
        return res.json({})
    }

    res.json(Object.fromEntries(userComponents));
});

app.post("/api/components", (req, res) => {
    const user = req.query.user as string

    if (!user) {
        return res.status(400).json({ error: "Missing user" })
    }

    const { name, data } = req.body

    if (!name || !data) {
        return res.status(400).json({ error: "Missing name or data" })
    }

    let userComponents = componentsByUser.get(user)
    if (!userComponents) {
        userComponents = new Map()
        componentsByUser.set(user, userComponents)
    }

    userComponents.set(name, data)

    res.json({ success: true })
})

app.delete("/api/components", (req, res) => {
    const user = req.query.user as string
    const { name } = req.body

    if (!user) {
        return res.status(400).json({ error: "Missing user" })
    }

    if (!name) {
        return res.status(400).json({ error: "Missing component name" })
    }

    let userComponents = componentsByUser.get(user)
    if (!userComponents || !userComponents.has(name)) {
        return res.status(404).json({ error: "Component not found" })
    }

    userComponents.delete(name)

    res.json({ success: true })
})

app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});