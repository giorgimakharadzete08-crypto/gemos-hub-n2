(() => {
    "use strict";

    const storageKey = "gemos-hub-cart-v1";
    const lastOrderStorageKey = "gemos-hub-last-order-v1";
    const duplicateOrderWindow = 10 * 60 * 1000;
    const whatsappNumber = "995511304011";
    const cart = new Map();
    let lastOrder;
    let toastTimer;
    const currentPage = window.location.pathname.split("/").pop();

    if ((currentPage === "" || currentPage === "index.html") && !window.location.hash) {
        window.location.hash = "menu";
    }

    const formatPrice = (price) => `${price} ₾`;

    const showToast = (message) => {
        const toast = document.querySelector(".cart-toast");
        toast.textContent = message;
        toast.classList.add("is-visible");
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => {
            toast.classList.remove("is-visible");
        }, 2400);
    };

    const saveCart = () => {
        try {
            window.localStorage.setItem(storageKey, JSON.stringify(Array.from(cart.values())));
        } catch (error) {
            console.error("Could not save the Gemos Hub cart.", error);
            showToast("კალათა ამ სესიაში იმუშავებს, მაგრამ შენახვა ვერ მოხერხდა.");
        }
    };

    const loadCart = () => {
        try {
            const saved = window.localStorage.getItem(storageKey);
            if (!saved) return;

            const items = JSON.parse(saved);
            if (!Array.isArray(items)) throw new TypeError("Saved cart must be a list.");

            for (const item of items) {
                if (
                    typeof item.id !== "string" ||
                    typeof item.name !== "string" ||
                    !Number.isSafeInteger(item.price) ||
                    item.price < 0 ||
                    !Number.isSafeInteger(item.quantity) ||
                    item.quantity < 1
                ) {
                    throw new TypeError("Saved cart contains an invalid item.");
                }

                cart.set(item.id, item);
            }
        } catch (error) {
            console.error("Could not restore the Gemos Hub cart.", error);
            showToast("წინა კალათის ჩატვირთვა ვერ მოხერხდა.");
            cart.clear();
        }
    };

    const makeElement = (tagName, className, text) => {
        const element = document.createElement(tagName);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    };

    const drawerRoot = makeElement("div", "cart-root");
    drawerRoot.innerHTML = `
        <button class="cart-backdrop" type="button" aria-label="კალათის დახურვა" hidden></button>
        <aside class="cart-drawer" id="shopping-cart" role="dialog" aria-modal="true" aria-labelledby="cart-title" aria-hidden="true" inert>
            <div class="cart-drawer-header">
                <div>
                    <p class="cart-kicker">Gemos Hub</p>
                    <h2 id="cart-title">შენი კალათა</h2>
                </div>
                <button class="cart-close" type="button" aria-label="კალათის დახურვა">×</button>
            </div>
            <p class="cart-message" aria-live="polite"></p>
            <div class="cart-items"></div>
            <p class="cart-empty">კალათა ჯერ ცარიელია. აირჩიე მენიუდან საყვარელი გემო.</p>
            <div class="cart-summary">
                <div class="cart-total-line"><span>ჯამი</span><strong class="cart-total">0 ₾</strong></div>
                <button class="cart-order" type="button" aria-disabled="true">WhatsApp-ში შეკვეთის გაგრძელება <span aria-hidden="true">↗</span></button>
                <p class="cart-order-note">გაიხსნება WhatsApp მზა შეკვეთით. გაგზავნისთვის დააჭირე Send-ს WhatsApp-ში.</p>
            </div>
        </aside>
        <dialog class="checkout-dialog" aria-labelledby="checkout-title">
            <form class="checkout-form">
                <h2 id="checkout-title">შეკვეთის დადასტურება</h2>
                <p class="checkout-total-line">საბოლოო თანხა: <strong class="checkout-total"></strong></p>
                <label for="checkout-name">სახელი <span aria-hidden="true">*</span></label>
                <input id="checkout-name" name="name" type="text" autocomplete="name" maxlength="80" required>
                <label for="checkout-phone">ტელეფონის ნომერი <span aria-hidden="true">*</span></label>
                <input id="checkout-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" minlength="7" maxlength="20" title="შეიყვანე ტელეფონის ნომერი" required>
                <label class="captcha-question" for="captcha-answer"></label>
                <input id="captcha-answer" name="captcha" type="text" inputmode="numeric" pattern="[0-9]{1,2}" autocomplete="off" required>
                <div class="checkout-trap" aria-hidden="true">
                    <label for="checkout-website">ეს ველი ცარიელი დატოვე</label>
                    <input id="checkout-website" name="website" type="text" tabindex="-1" autocomplete="off">
                </div>
                <p class="checkout-status" role="status" aria-live="polite"></p>
                <div class="checkout-actions">
                    <button class="checkout-cancel" type="button">უკან</button>
                    <button class="checkout-submit" type="submit">შეკვეთის გაგრძელება</button>
                </div>
            </form>
        </dialog>
        <div class="cart-toast" role="status" aria-live="polite"></div>
    `;
    document.body.append(drawerRoot);

    const toggleButton = makeElement("button", "cart-toggle");
    toggleButton.type = "button";
    toggleButton.setAttribute("aria-controls", "shopping-cart");
    toggleButton.setAttribute("aria-expanded", "false");
    toggleButton.innerHTML = '<span class="cart-toggle-icon" aria-hidden="true">🛒</span><span>კალათა</span><span class="cart-count" aria-label="0 პროდუქტი">0</span>';
    document.body.append(toggleButton);

    const panel = drawerRoot.querySelector(".cart-drawer");
    const backdrop = drawerRoot.querySelector(".cart-backdrop");
    const closeButton = drawerRoot.querySelector(".cart-close");
    const itemList = drawerRoot.querySelector(".cart-items");
    const emptyMessage = drawerRoot.querySelector(".cart-empty");
    const totalLabel = drawerRoot.querySelector(".cart-total");
    const orderLink = drawerRoot.querySelector(".cart-order");
    const itemCountLabel = toggleButton.querySelector(".cart-count");
    const orderMessage = drawerRoot.querySelector(".cart-message");
    const checkoutDialog = drawerRoot.querySelector(".checkout-dialog");
    const checkoutForm = drawerRoot.querySelector(".checkout-form");
    const checkoutName = drawerRoot.querySelector("#checkout-name");
    const checkoutPhone = drawerRoot.querySelector("#checkout-phone");
    const captchaQuestion = drawerRoot.querySelector(".captcha-question");
    const captchaAnswer = drawerRoot.querySelector("#captcha-answer");
    const checkoutTrap = drawerRoot.querySelector("#checkout-website");
    const checkoutTotal = drawerRoot.querySelector(".checkout-total");
    const checkoutStatus = drawerRoot.querySelector(".checkout-status");
    const checkoutCancel = drawerRoot.querySelector(".checkout-cancel");
    let captchaSolution;

    const getCartItems = () => Array.from(cart.values());
    const getCartTotal = (items) => items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const setCaptchaChallenge = () => {
        const firstNumber = Math.floor(Math.random() * 9) + 1;
        const secondNumber = Math.floor(Math.random() * 9) + 1;
        captchaSolution = firstNumber + secondNumber;
        captchaQuestion.textContent = `დაადასტურე, რომ ადამიანი ხარ: რამდენია ${firstNumber} + ${secondNumber}?`;
        captchaAnswer.value = "";
    };

    const getOrderSignature = (items, phone) => JSON.stringify({
        phone: phone.replace(/\D/g, ""),
        items: items
            .map((item) => ({ id: item.id, quantity: item.quantity }))
            .sort((first, second) => first.id.localeCompare(second.id))
    });

    const getLastOrder = () => {
        try {
            const saved = window.localStorage.getItem(lastOrderStorageKey);
            if (!saved) return lastOrder;
            const parsed = JSON.parse(saved);
            if (
                typeof parsed.signature !== "string" ||
                !Number.isSafeInteger(parsed.createdAt) ||
                parsed.createdAt < 0
            ) {
                throw new TypeError("Saved order record is invalid.");
            }
            lastOrder = parsed;
        } catch (error) {
            console.error("Could not read the previous Gemos Hub order.", error);
            showToast("წინა შეკვეთის შემოწმება ვერ მოხერხდა; დუბლირების შეზღუდვა ამ ბრაუზერში იმუშავებს.");
        }
        return lastOrder;
    };

    const renderCart = () => {
        const items = getCartItems();
        const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
        const totalPrice = getCartTotal(items);

        itemCountLabel.textContent = String(totalCount);
        itemCountLabel.setAttribute("aria-label", `${totalCount} პროდუქტი`);
        totalLabel.textContent = formatPrice(totalPrice);
        emptyMessage.hidden = items.length > 0;
        orderLink.setAttribute("aria-disabled", String(items.length === 0));
        orderLink.disabled = items.length === 0;
        orderLink.tabIndex = items.length ? 0 : -1;

        itemList.replaceChildren();
        for (const item of items) {
            const row = makeElement("article", "cart-item");
            const detail = makeElement("div", "cart-item-details");
            detail.append(
                makeElement("h3", "cart-item-name", item.name),
                makeElement("p", "cart-item-price", `${formatPrice(item.price)} / ცალი`)
            );

            const controls = makeElement("div", "cart-item-controls");
            const decreaseButton = makeElement("button", "cart-quantity-button", "−");
            decreaseButton.type = "button";
            decreaseButton.setAttribute("aria-label", `${item.name}: რაოდენობის შემცირება`);
            decreaseButton.addEventListener("click", () => changeQuantity(item.id, -1));

            const quantity = makeElement("span", "cart-item-quantity", String(item.quantity));
            quantity.setAttribute("aria-label", "რაოდენობა");

            const increaseButton = makeElement("button", "cart-quantity-button", "+");
            increaseButton.type = "button";
            increaseButton.setAttribute("aria-label", `${item.name}: რაოდენობის გაზრდა`);
            increaseButton.addEventListener("click", () => changeQuantity(item.id, 1));

            const removeButton = makeElement("button", "cart-remove", "წაშლა");
            removeButton.type = "button";
            removeButton.addEventListener("click", () => removeItem(item.id));

            controls.append(decreaseButton, quantity, increaseButton, removeButton);
            row.append(detail, controls);
            itemList.append(row);
        }
    };

    const addItem = (name, price) => {
        const id = `${name}|${price}`;
        const item = cart.get(id);
        if (item) item.quantity += 1;
        else cart.set(id, { id, name, price, quantity: 1 });
        saveCart();
        renderCart();
        showToast(`${name} დაემატა კალათაში`);
    };

    function changeQuantity(id, amount) {
        const item = cart.get(id);
        if (!item) return;
        item.quantity += amount;
        if (item.quantity < 1) cart.delete(id);
        saveCart();
        renderCart();
    }

    function removeItem(id) {
        cart.delete(id);
        saveCart();
        renderCart();
    }

    function initializeReviews() {
        const form = document.querySelector("#review-form");
        const status = document.querySelector("#review-status");
        const emailButton = document.querySelector("#review-email-button");
        const whatsappButton = document.querySelector("#review-whatsapp-button");
        if (
            !(form instanceof HTMLDivElement) ||
            !status ||
            !(emailButton instanceof HTMLButtonElement) ||
            !(whatsappButton instanceof HTMLButtonElement)
        ) return;

        const nameInput = form.querySelector("#review-name");
        const commentInput = form.querySelector("#review-comment");

        const prepareReview = () => {
            const selectedRating = form.querySelector('input[name="rating"]:checked');
            const rating = Number(selectedRating?.value);
            const comment = commentInput instanceof HTMLTextAreaElement ? commentInput.value.trim() : "";
            const name = nameInput instanceof HTMLInputElement ? nameInput.value.trim() : "";
            if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !comment) {
                status.textContent = "მიუთითე შეფასება და დატოვე კომენტარი.";
                return null;
            }

            const reviewMessage = `Gemos Hub-ის შეფასება\nშეფასება: ${rating}/5\nსახელი: ${name || "სტუმარი"}\nკომენტარი: ${comment}`;
            status.textContent = "მადლობა შეფასებისთვის! შეტყობინება მზადაა გასაგზავნად.";
            return reviewMessage;
        };

        emailButton.addEventListener("click", () => {
            const reviewMessage = prepareReview();
            if (!reviewMessage) return;
            const subject = encodeURIComponent("Gemos Hub-ის შეფასება");
            const body = encodeURIComponent(reviewMessage);
            window.location.href = `mailto:gemoshub1@gmail.com?subject=${subject}&body=${body}`;
        });

        whatsappButton.addEventListener("click", () => {
            const reviewMessage = prepareReview();
            if (!reviewMessage) return;
            const message = encodeURIComponent(reviewMessage);
            window.open(`https://wa.me/${whatsappNumber}?text=${message}`, "_blank", "noopener,noreferrer");
        });
    }

    const openCart = () => {
        panel.inert = false;
        panel.setAttribute("aria-hidden", "false");
        backdrop.hidden = false;
        requestAnimationFrame(() => {
            panel.classList.add("is-open");
            backdrop.classList.add("is-visible");
        });
        toggleButton.setAttribute("aria-expanded", "true");
        document.body.classList.add("cart-open");
        closeButton.focus();
    };

    const closeCart = () => {
        panel.classList.remove("is-open");
        backdrop.classList.remove("is-visible");
        panel.setAttribute("aria-hidden", "true");
        panel.inert = true;
        backdrop.hidden = true;
        toggleButton.setAttribute("aria-expanded", "false");
        document.body.classList.remove("cart-open");
        toggleButton.focus();
    };

    document.querySelectorAll(".product-row").forEach((row) => {
        const name = row.querySelector("h3")?.textContent.trim();
        const priceText = row.querySelector(".product-price")?.textContent ?? "";
        const price = Number(priceText.replace(/[^\d]/g, ""));
        if (!name || !Number.isSafeInteger(price) || price < 0) return;

        const addButton = makeElement("button", "add-to-cart");
        addButton.type = "button";
        addButton.setAttribute("aria-label", `${name} — კალათაში დამატება`);
        addButton.innerHTML = '<span aria-hidden="true">+</span><span class="add-to-cart-label">დამატება</span>';
        addButton.addEventListener("click", () => addItem(name, price));
        row.append(addButton);
    });

    toggleButton.addEventListener("click", openCart);
    closeButton.addEventListener("click", closeCart);
    backdrop.addEventListener("click", closeCart);
    orderLink.addEventListener("click", () => {
        if (cart.size === 0) {
            orderMessage.textContent = "შეკვეთისთვის ჯერ დაამატე პროდუქტი კალათაში.";
            return;
        }
        checkoutTotal.textContent = formatPrice(getCartTotal(getCartItems()));
        checkoutName.value = "";
        checkoutPhone.value = "";
        checkoutStatus.textContent = "";
        checkoutTrap.value = "";
        setCaptchaChallenge();
        checkoutDialog.showModal();
        checkoutName.focus();
    });
    checkoutCancel.addEventListener("click", () => checkoutDialog.close());
    checkoutForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const items = getCartItems();
        if (items.length === 0) {
            checkoutStatus.textContent = "შეკვეთის გასაგრძელებლად კალათა ცარიელია.";
            checkoutDialog.close();
            return;
        }

        if (checkoutTrap.value) {
            checkoutStatus.textContent = "ფორმის შემოწმება ვერ მოხერხდა. სცადე თავიდან.";
            setCaptchaChallenge();
            return;
        }

        const name = checkoutName.value.trim();
        const phone = checkoutPhone.value.trim();
        if (!name || phone.replace(/\D/g, "").length < 7 || Number(captchaAnswer.value) !== captchaSolution) {
            checkoutStatus.textContent = "შეამოწმე სახელი, ტელეფონის ნომერი და CAPTCHA-ის პასუხი.";
            setCaptchaChallenge();
            return;
        }

        const signature = getOrderSignature(items, phone);
        const previousOrder = getLastOrder();
        const timeSincePreviousOrder = previousOrder ? Date.now() - previousOrder.createdAt : Infinity;
        if (
            previousOrder?.signature === signature &&
            timeSincePreviousOrder >= 0 &&
            timeSincePreviousOrder < duplicateOrderWindow
        ) {
            checkoutStatus.textContent = "ეს შეკვეთა ბოლო 10 წუთში უკვე მომზადდა გასაგზავნად. დუბლირების თავიდან ასაცილებლად, მოგვიანებით სცადე.";
            return;
        }

        const totalPrice = getCartTotal(items);
        if (!window.confirm(`ნამდვილად გსურთ შეკვეთის გაგზავნა?\nსაბოლოო თანხა: ${formatPrice(totalPrice)}`)) return;

        const orderRecord = { signature, createdAt: Date.now() };
        lastOrder = orderRecord;
        try {
            window.localStorage.setItem(lastOrderStorageKey, JSON.stringify(orderRecord));
        } catch (error) {
            console.error("Could not save the previous Gemos Hub order.", error);
            showToast("დუბლირების შეზღუდვა მხოლოდ ამ სესიაში იმუშავებს.");
        }

        const message = `გამარჯობა, Gemos Hub! მინდა შეკვეთა:\n${items
            .map((item) => `- ${item.name} x${item.quantity} — ${formatPrice(item.price * item.quantity)}`)
            .join("\n")}\nჯამი: ${formatPrice(totalPrice)}\nსახელი: ${name}\nტელეფონი: ${phone}`;
        const whatsappUrl = `https://api.whatsapp.com/send?phone=${whatsappNumber}&text=${encodeURIComponent(message)}`;
        window.location.assign(whatsappUrl);
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !panel.inert) closeCart();
        if (event.key !== "Tab" || panel.inert) return;

        const focusable = Array.from(
            panel.querySelectorAll('a[href]:not([tabindex="-1"]), button:not([disabled])')
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;

        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });

    loadCart();
    renderCart();
    initializeReviews();
})();
