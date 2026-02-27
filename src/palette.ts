import type { Sim } from "./sim";

export class Palette {
    container: HTMLElement;
    sections: Map<string, HTMLElement>;
    private items = new Map<string, HTMLElement>();
    sim: Sim

    constructor(containerId: string, sim: Sim) {
        this.sim = sim
        this.container = document.getElementById(containerId)!;
        this.sections = new Map();

        // Init sections
        for (const section of this.container.querySelectorAll<HTMLElement>(".palette-section")) {
            const header = section.querySelector(".palette-header")!;
            const items = section.querySelector<HTMLElement>(".palette-items")!;
            this.sections.set(header.textContent || "", items);

            // Section collapse/expand listener
            header.addEventListener("click", () => {
                section.classList.toggle("open");
            });
        }

        // Init existing items with the drag callback
        this.container.querySelectorAll<HTMLElement>(".palette-item").forEach(el => {
            this.bindItem(el);
        });
    }

    addItem(sectionName: string, name: string, type: string) {
        if(this.items.has(name)) return

        const section = this.sections.get(sectionName)
        if (!section) return

        const row = document.createElement("div")
        row.className = "palette-row"

        const item = document.createElement("div")
        item.className = "palette-item"
        item.textContent = name
        item.dataset.type = type
        item.dataset.name = name

        const editBtn = document.createElement("button")
        editBtn.className = "palette-edit"
        editBtn.innerHTML = "&#9998;"
        editBtn.title = "Edit component"

        editBtn.addEventListener("click", e => {
            e.stopPropagation()
            this.onEdit?.(name)
        })

        this.bindItem(item)

        row.appendChild(item)
        row.appendChild(editBtn)
        section.appendChild(row)

        this.items.set(name, row)
    }

    clearSection(sectionName: string) {
        const section = this.sections.get(sectionName);
        if (!section) return;
        section.innerHTML = "";
    }

    onEdit?(name: string) {
        console.log("gonna edit " + name)
        this.sim.load(name)
    }

    private bindItem(el: HTMLElement) {
        el.addEventListener("mousedown", () => {
            this.sim.startPaletteDrag(el.dataset.type!, el.dataset.name);
        });
    }
}