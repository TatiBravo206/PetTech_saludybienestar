/* =========================================================
   PETTECH - MARKETPLACE
   Gestión del catálogo y carrito de compras
   ========================================================= */


/* =========================================================
   CATÁLOGO
   ========================================================= */

const PETTECH_PRODUCTS = [

    {
        id: "prod-001",
        name: "Alimento Premium",
        icon: "🥣",
        description: "Alimento balanceado para perros y gatos.",
        price: 45000,
    },

    {
        id: "prod-002",
        name: "Collar para mascota",
        description: "Collar cómodo y resistente para mascotas.",
        price: 28000,
        icon: "🐕"
    },

    {
        id: "prod-003",
        name: "Juguete interactivo",
        description: "Juguete diseñado para estimular a tu mascota.",
        price: 22000,
        icon: "🧸"
    },

    {
        id: "prod-004",
        name: "Cama para mascota",
        description: "Cama acolchada para mejorar el descanso.",
        price: 85000,
        icon: "🛏️"
    },

    {
        id: "prod-005",
        name: "Kit de higiene",
        description: "Elementos básicos para el cuidado e higiene.",
        price: 35000,
        icon: "🧴"
    },

    {
        id: "prod-006",
        name: "Plato para mascota",
        description: "Plato práctico para comida y agua.",
        price: 18000,
        icon: "🍽️"
    },

    {
        id: "prod-007",
        name: "Pelota recreativa",
        description: "Pelota para juegos y actividad física.",
        price: 15000,
        icon: "⚽"
    },

    {
        id: "prod-008",
        name: "Transportadora",
        description: "Transportadora para viajes y visitas veterinarias.",
        price: 95000,
        icon: "🧳"
    }

];


/* =========================================================
   VARIABLES
   ========================================================= */

const CART_STORAGE_KEY =
    "PetTech_carrito";


function loadCart() {
    try {
        const stored = JSON.parse(localStorage.getItem(CART_STORAGE_KEY));
        return Array.isArray(stored) ? stored.filter(isValidCartItem) : [];
    } catch {
        return [];
    }
}

function isValidCartItem(item) {
    return Boolean(
        item &&
        typeof item.productId === "string" &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0
    );
}

let cart = loadCart();


/* =========================================================
   FORMATEAR DINERO
   ========================================================= */

function formatCurrency(value) {

    return new Intl.NumberFormat(
        "es-CO",
        {
            style: "currency",
            currency: "COP",
            maximumFractionDigits: 0
        }
    ).format(value);

}


/* =========================================================
   GUARDAR CARRITO
   ========================================================= */

function saveCart() {

    localStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify(cart)
    );

}


/* =========================================================
   RENDERIZAR PRODUCTOS
   ========================================================= */

function renderProducts() {

    const productGrid =
        document.getElementById("productGrid");

    if (!productGrid) {
        return;
    }


    productGrid.innerHTML = "";


    PETTECH_PRODUCTS.forEach(product => {

        const card =
            document.createElement("article");

        card.className =
            "product-card";


        card.innerHTML = `

            <div class="product-image">
                ${product.icon}
            </div>

            <div class="product-content">

                <h3>
                    ${product.name}
                </h3>

                <p class="product-description">
                    ${product.description}
                </p>

                <div class="product-bottom">

                    <span class="product-price">
                        ${formatCurrency(product.price)}
                    </span>

                    <button
                        type="button"
                        class="btn btn-primary"
                        data-product-id="${product.id}">
                        Agregar
                    </button>

                </div>

            </div>
        `;


        const addButton =
            card.querySelector(
                "[data-product-id]"
            );


        addButton.addEventListener("click", () => addToCart(product.id));


        productGrid.appendChild(card);

    });

}


/* =========================================================
   AGREGAR AL CARRITO
   ========================================================= */

function addToCart(productId) {

    const existingItem =
        cart.find(
            item => item.productId === productId
        );


    if (existingItem) {

        existingItem.quantity++;

    } else {

        cart.push({

            productId,
            quantity: 1

        });

    }


    saveCart();

    renderCart();

    showMarketplaceMessage(
        "Producto agregado correctamente al carrito."
    );

}


/* =========================================================
   MODIFICAR CANTIDAD
   ========================================================= */

function changeQuantity(
    productId,
    amount
) {

    const item =
        cart.find(
            item => item.productId === productId
        );


    if (!item) {
        return;
    }


    item.quantity += amount;


    if (item.quantity <= 0) {

        cart =
            cart.filter(
                item => item.productId !== productId
            );

    }


    saveCart();

    renderCart();

}


/* =========================================================
   ELIMINAR
   ========================================================= */

function removeFromCart(productId) {

    cart =
        cart.filter(
            item => item.productId !== productId
        );


    saveCart();

    renderCart();

}


/* =========================================================
   TOTAL
   ========================================================= */

function calculateTotal() {

    return cart.reduce(
        (total, item) => {

            const product =
                PETTECH_PRODUCTS.find(
                    product =>
                        product.id === item.productId
                );


            if (!product) {
                return total;
            }


            return total +
                product.price * item.quantity;

        },
        0
    );

}


/* =========================================================
   CANTIDAD TOTAL
   ========================================================= */

function calculateCartCount() {

    return cart.reduce(
        (total, item) =>
            total + item.quantity,
        0
    );

}


/* =========================================================
   RENDERIZAR CARRITO
   ========================================================= */

function renderCart() {

    const cartItems =
        document.getElementById("cartItems");

    const cartTotal =
        document.getElementById("cartTotal");

    const cartCount =
        document.getElementById("cartCount");


    if (!cartItems) {
        return;
    }


    cartItems.innerHTML = "";


    if (cart.length === 0) {

        cartItems.innerHTML = `

            <div class="empty-cart">

                <div class="empty-cart-icon" aria-hidden="true">🛒</div>

                <p>
                    Tu carrito está vacío.
                </p>

            </div>
        `;

    } else {

        cart.forEach(item => {

            const product =
                PETTECH_PRODUCTS.find(
                    product =>
                        product.id === item.productId
                );


            if (!product) {
                return;
            }


            const itemElement =
                document.createElement("div");

            itemElement.className =
                "cart-item";


            itemElement.innerHTML = `

                <div class="cart-item-main">

                    <div>

                        <h4>
                            ${product.icon}
                            ${product.name}
                        </h4>

                        <span class="cart-item-price">
                            ${formatCurrency(product.price)}
                        </span>

                    </div>

                    <button
                        type="button"
                        class="remove-cart-item"
                        data-remove="${product.id}">
                        Eliminar
                    </button>

                </div>


                <div class="quantity-controls">

                    <button
                        type="button"
                        data-minus="${product.id}">
                        −
                    </button>

                    <strong>
                        ${item.quantity}
                    </strong>

                    <button
                        type="button"
                        data-plus="${product.id}">
                        +
                    </button>

                </div>

            `;


            cartItems.appendChild(itemElement);

        });

    }


    cartTotal.textContent =
        formatCurrency(
            calculateTotal()
        );


    cartCount.textContent =
        calculateCartCount();


    document
        .querySelectorAll("[data-minus]")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    changeQuantity(
                        button.dataset.minus,
                        -1
                    );

                }
            );

        });


    document
        .querySelectorAll("[data-plus]")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    changeQuantity(
                        button.dataset.plus,
                        1
                    );

                }
            );

        });


    document
        .querySelectorAll("[data-remove]")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    removeFromCart(
                        button.dataset.remove
                    );

                }
            );

        });

}


/* =========================================================
   MENSAJE
   ========================================================= */

function showMarketplaceMessage(message) {

    const element =
        document.getElementById(
            "marketplaceMessage"
        );


    if (!element) {
        return;
    }


    element.textContent = message;

    element.className =
        "message-box";


    setTimeout(() => {

        element.className =
            "message-box hidden";

    }, 3000);

}


/* =========================================================
   CARRITO ABRIR / CERRAR
   ========================================================= */

function setupCartEvents() {

    const cartPanel =
        document.getElementById("cartPanel");

    const openCartBtn =
        document.getElementById("openCartBtn");

    const closeCartBtn =
        document.getElementById("closeCartBtn");


    if (!cartPanel) {
        return;
    }


    openCartBtn.addEventListener(
        "click",
        () => {

            cartPanel.classList.add("open");

        }
    );


    closeCartBtn.addEventListener(
        "click",
        () => {

            cartPanel.classList.remove("open");

        }
    );

}


/* =========================================================
   CHECKOUT
   ========================================================= */

function setupCheckout() {

    const checkoutBtn =
        document.getElementById("checkoutBtn");


    if (!checkoutBtn) {
        return;
    }


    checkoutBtn.addEventListener(
        "click",
        () => {

            if (cart.length === 0) {

                showMarketplaceMessage(
                    "Agrega productos antes de finalizar la compra."
                );

                return;
            }


            const order = {

                id:
                    "ORD-" +
                    Date.now(),

                items:
                    [...cart],

                total:
                    calculateTotal(),

                createdAt:
                    new Date().toISOString(),

                status:
                    "Compra simulada exitosa"

            };


            const orders =
                JSON.parse(
                    localStorage.getItem(
                        "PetTech_compras"
                    )
                ) || [];


            orders.push(order);


            localStorage.setItem(
                "PetTech_compras",
                JSON.stringify(orders)
            );


            cart = [];

            saveCart();

            renderCart();


            showMarketplaceMessage(
                "¡Compra realizada exitosamente! Esta es una simulación."
            );

        }
    );

}


/* =========================================================
   INICIALIZACIÓN
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        renderProducts();

        renderCart();

        setupCartEvents();

        setupCheckout();

    }
);