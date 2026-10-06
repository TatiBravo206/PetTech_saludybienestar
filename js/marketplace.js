/* =========================================================
   PETTECH - TIENDAS ALIADAS (COLOMBIA)
   Directorio de tiendas especializadas en productos para mascotas
   ========================================================= */

const PARTNER_STORES = [
    {
        id: "store-001",
        name: "Laika Colombia",
        logoImg: "image/laika.png",
        description: "Tienda online líder en Colombia para alimentos, snacks, medicina y accesorios para perros y gatos.",
        url: "https://laika.com.co",
        badge: "Envíos a todo el país"
    },
    {
        id: "store-002",
        name: "Agrocampo",
        logoImg: "image/agrocampo.png",
        description: "Hipermercado de productos para mascotas con amplio catálogo en nutrición, farmacia y artículos de higiene.",
        url: "https://www.agrocampo.com.co",
        badge: "Tienda Oficial & En Línea"
    },
    {
        id: "store-003",
        name: "Tierragro",
        logoImg: "image/tierragro.png",
        description: "Especialistas en nutrición, juguetes, camas y bienestar integral para el cuidado de tus mascotas.",
        url: "https://www.tierragro.com",
        badge: "Variedad & Calidad"
    }
];

/* =========================================================
   RENDERIZAR TIENDAS ALIADAS
   ========================================================= */

function renderPartnerStores() {
    const productGrid = document.getElementById("productGrid");

    if (!productGrid) {
        return;
    }

    productGrid.innerHTML = "";

    PARTNER_STORES.forEach(store => {
        const card = document.createElement("article");
        card.className = "partner-card";

        card.innerHTML = `
            <div class="partner-image">
                <img src="${store.logoImg}" alt="Logo ${store.name}" class="partner-logo-img">
            </div>
            <div class="partner-content">
                <span class="partner-badge">${store.badge}</span>
                <h3>${store.name}</h3>
                <p class="partner-description">
                    ${store.description}
                </p>
                <div class="partner-bottom">
                    <a href="${store.url}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-full">
                        Visitar tienda ↗
                    </a>
                </div>
            </div>
        `;

        productGrid.appendChild(card);
    });
}

/* =========================================================
   INICIALIZACIÓN
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    renderPartnerStores();
});