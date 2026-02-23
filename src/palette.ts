import type { Sim } from "./sim";

export class Palette {
    container: HTMLElement;
    sections: Map<string, HTMLElement>;
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
        const section = this.sections.get(sectionName);
        if (!section) return;

        const div = document.createElement("div");
        div.className = "palette-item";
        div.textContent = name;
        div.dataset.type = type;
        div.dataset.name = name;

        this.bindItem(div)

        section.appendChild(div);
    }

    clearSection(sectionName: string) {
        const section = this.sections.get(sectionName);
        if (!section) return;
        section.innerHTML = "";
    }

    private bindItem(el: HTMLElement) {
        el.addEventListener("mousedown", () => {
            this.sim.startPaletteDrag(el.dataset.type!, el.dataset.name);
        });
    }
}