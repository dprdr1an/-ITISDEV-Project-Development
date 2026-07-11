"use strict";

// Task checkbox toggle
document.querySelectorAll(".task-checkbox:not(.checked)").forEach(cb => {

    cb.addEventListener("click", () => {

        cb.classList.toggle("checked");

        const taskName =
            cb.closest(".task-item")
              .querySelector(".task-name");

        if (cb.classList.contains("checked")) {

            cb.innerHTML = `
                <svg viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
            `;

            taskName.classList.add("done");

        } else {

            cb.innerHTML = "";

            taskName.classList.remove("done");

        }

    });

});

// Animate dashboard progress bars
window.addEventListener("load", () => {

    document.querySelectorAll(
        ".progress-bar-fill, .workload-bar-fill, .mockup-bar-fill"
    ).forEach(bar => {

        const target = bar.style.width;

        bar.style.width = "0%";

        bar.style.transition =
            "width 1s cubic-bezier(0.4,0,0.2,1)";

        setTimeout(() => {

            bar.style.width = target;

        }, 200);

    });

});

// Navigation active state
document.querySelectorAll(".nav-item").forEach(item => {

    item.addEventListener("click", function (e) {

        if (this.getAttribute("href") === "#") {

            e.preventDefault();

            document
                .querySelectorAll(".nav-item")
                .forEach(nav =>
                    nav.classList.remove("active")
                );

            this.classList.add("active");

        }

    });

});