// ==========================================
// STOCKSENSE - MAIN JAVASCRIPT
// ==========================================


// ==========================================
// SIDEBAR NAVIGATION
// ==========================================

const navLinks = document.querySelectorAll(".nav-link");

const dashboardSection = document.querySelector(".dashboard");
const productsSection = document.querySelector("#products-section");

const sidebarLinks = document.querySelectorAll(
    ".sidebar-nav > .nav-link, .sidebar-nav .nav-section .nav-link"
);

const dashboardLink = sidebarLinks[0];
const productsLink = sidebarLinks[1];


// Dashboard
dashboardLink.addEventListener("click", function (event) {
    event.preventDefault();

    dashboardSection.style.display = "block";
    productsSection.style.display = "none";

    navLinks.forEach(function (link) {
        link.classList.remove("active");
    });

    this.classList.add("active");
});


// Products
productsLink.addEventListener("click", function (event) {
    event.preventDefault();

    dashboardSection.style.display = "none";
    productsSection.style.display = "block";

    navLinks.forEach(function (link) {
        link.classList.remove("active");
    });

    this.classList.add("active");
});


// Other sidebar links
navLinks.forEach(function (link) {

    if (link === dashboardLink || link === productsLink) {
        return;
    }

    link.addEventListener("click", function (event) {
        event.preventDefault();

        navLinks.forEach(function (item) {
            item.classList.remove("active");
        });

        this.classList.add("active");
    });
});


// ==========================================
// PRODUCT SEARCH
// ==========================================

const searchInput = document.querySelector(".search-box input");

if (searchInput) {

    searchInput.addEventListener("input", function () {

        const searchText = this.value.toLowerCase().trim();

        const productRows = document.querySelectorAll(
            "#products-table tbody tr"
        );

        productRows.forEach(function (row) {

            const rowText = row.textContent.toLowerCase();

            row.style.display =
                rowText.includes(searchText) ? "" : "none";

        });

    });

}


// ==========================================
// DASHBOARD STOCK NUMBERS
// ==========================================

function updateStockNumbers() {

    const productRows = document.querySelectorAll(
        "#products-table tbody tr"
    );

    let lowStock = 0;
    let outOfStock = 0;

    productRows.forEach(function (row) {

        const status = row.querySelector(".status");

        if (!status) {
            return;
        }

        if (status.classList.contains("status-low")) {
            lowStock++;
        }

        if (status.classList.contains("status-danger")) {
            outOfStock++;
        }

    });


    const kpiCards = document.querySelectorAll(".kpi-card");

    if (kpiCards.length >= 3) {

        kpiCards[1].querySelector("h3").textContent = lowStock;

        kpiCards[2].querySelector("h3").textContent = outOfStock;

    }

}


// Run once when page loads
updateStockNumbers();


// ==========================================
// DASHBOARD FILTERS
// ==========================================

const filterSelects = document.querySelectorAll(
    ".filter-bar select"
);

function applyFilters() {

    if (filterSelects.length < 4) {
        return;
    }

    const documentType = filterSelects[0].value;
    const status = filterSelects[1].value;
    const warehouse = filterSelects[2].value;
    const category = filterSelects[3].value;


    const dashboardRows = document.querySelectorAll(
        ".dashboard .panel table tbody tr"
    );


    dashboardRows.forEach(function (row) {

        const rowText = row.textContent.toLowerCase();


        const matchesDocument =
            documentType === "All Document Types" ||
            rowText.includes(documentType.toLowerCase());


        const matchesStatus =
            status === "All Statuses" ||
            rowText.includes(status.toLowerCase());


        const matchesWarehouse =
            warehouse === "All Warehouses" ||
            rowText.includes(warehouse.toLowerCase());


        const matchesCategory =
            category === "All Categories" ||
            rowText.includes(category.toLowerCase());


        if (
            matchesDocument &&
            matchesStatus &&
            matchesWarehouse &&
            matchesCategory
        ) {

            row.style.display = "";

        } else {

            row.style.display = "none";

        }

    });

}


filterSelects.forEach(function (select) {

    select.addEventListener("change", applyFilters);

});


// ==========================================
// ADD PRODUCT MODAL
// ==========================================

const addProductButton =
    document.querySelector("#add-product-button");

const productModal =
    document.querySelector("#product-modal");

const closeProductModal =
    document.querySelector("#close-product-modal");

const cancelProductButton =
    document.querySelector("#cancel-product");

const productForm =
    document.querySelector("#product-form");


// Row currently being edited
let editingRow = null;


// Open Add Product modal
addProductButton.addEventListener("click", function () {

    editingRow = null;

    productForm.reset();

    productModal.style.display = "flex";

});


// Close modal
function closeModal() {

    productModal.style.display = "none";

    editingRow = null;

    productForm.reset();

}


// Close button
closeProductModal.addEventListener(
    "click",
    closeModal
);


// Cancel button
cancelProductButton.addEventListener(
    "click",
    closeModal
);


// Click outside modal
productModal.addEventListener(
    "click",
    function (event) {

        if (event.target === productModal) {
            closeModal();
        }

    }
);


// ==========================================
// ADD / EDIT PRODUCT
// ==========================================

productForm.addEventListener(
    "submit",
    function (event) {

        event.preventDefault();


        // Get values
        const name =
            document.querySelector("#product-name")
                .value
                .trim();

        const sku =
            document.querySelector("#product-sku")
                .value
                .trim();

        const category =
            document.querySelector("#product-category")
                .value;

        const unit =
            document.querySelector("#product-unit")
                .value;

        const stock =
            Number(
                document.querySelector("#product-stock")
                    .value
            );

        const reorderLevel =
            Number(
                document.querySelector("#product-reorder")
                    .value
            );


        // Determine status
        let statusText = "Healthy";
        let statusClass = "status-healthy";


        if (stock === 0) {

            statusText = "Out of Stock";
            statusClass = "status-danger";

        } else if (stock <= reorderLevel) {

            statusText = "Low";
            statusClass = "status-low";

        }


        // ======================================
        // EDIT EXISTING PRODUCT
        // ======================================

        if (editingRow) {

            const cells =
                editingRow.querySelectorAll("td");


            cells[0].innerHTML =
                `<strong>${name}</strong>`;

            cells[1].textContent =
                sku;

            cells[2].textContent =
                category;

            cells[3].textContent =
                unit;

            cells[4].textContent =
                stock;

            cells[5].textContent =
                "Main Warehouse";

            cells[6].textContent =
                reorderLevel;

            cells[7].innerHTML =
                `<span class="status ${statusClass}">
                    ${statusText}
                </span>`;


            closeModal();

            updateStockNumbers();

            return;
        }


        // ======================================
        // ADD NEW PRODUCT
        // ======================================

        const tableBody =
            document.querySelector(
                "#products-table tbody"
            );


        const newRow =
            document.createElement("tr");


        newRow.innerHTML = `

            <td>
                <strong>${name}</strong>
            </td>

            <td>
                ${sku}
            </td>

            <td>
                ${category}
            </td>

            <td>
                ${unit}
            </td>

            <td>
                ${stock}
            </td>

            <td>
                Main Warehouse
            </td>

            <td>
                ${reorderLevel}
            </td>

            <td>
                <span class="status ${statusClass}">
                    ${statusText}
                </span>
            </td>

            <td>

                <button
                    class="small-button edit-product"
                >
                    Edit
                </button>

                <button
                    class="small-button delete-product"
                >
                    Delete
                </button>

            </td>

        `;


        tableBody.appendChild(newRow);


        closeModal();

        updateStockNumbers();

    }
);


// ==========================================
// DELETE PRODUCT
// ==========================================

document.addEventListener(
    "click",
    function (event) {

        if (
            !event.target.classList.contains(
                "delete-product"
            )
        ) {
            return;
        }


        const row =
            event.target.closest("tr");


        if (!row) {
            return;
        }


        const productName =
            row.querySelector("td")
                .textContent
                .trim();


        const confirmed =
            confirm(
                `Are you sure you want to delete ${productName}?`
            );


        if (confirmed) {

            row.remove();

            updateStockNumbers();

        }

    }
);


// ==========================================
// EDIT PRODUCT
// ==========================================

document.addEventListener(
    "click",
    function (event) {

        if (
            !event.target.classList.contains(
                "edit-product"
            )
        ) {
            return;
        }


        editingRow =
            event.target.closest("tr");


        if (!editingRow) {
            return;
        }


        const cells =
            editingRow.querySelectorAll("td");


        // Product name
        document.querySelector(
            "#product-name"
        ).value =
            cells[0].textContent.trim();


        // SKU
        document.querySelector(
            "#product-sku"
        ).value =
            cells[1].textContent.trim();


        // Category
        document.querySelector(
            "#product-category"
        ).value =
            cells[2].textContent.trim();


        // Unit
        document.querySelector(
            "#product-unit"
        ).value =
            cells[3].textContent.trim();


        // Stock
        document.querySelector(
            "#product-stock"
        ).value =
            cells[4].textContent.trim();


        // Reorder level
        document.querySelector(
            "#product-reorder"
        ).value =
            cells[6].textContent.trim();


        // Open modal
        productModal.style.display = "flex";

    }
);