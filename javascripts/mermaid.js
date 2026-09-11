document.addEventListener("DOMContentLoaded", function () {
    const elements = document.querySelectorAll(".mermaid");

    elements.forEach(function (element) {
        element.textContent = element.textContent.trim();
    });

    mermaid.initialize({
        startOnLoad: false
    });

    mermaid.run({
        nodes: document.querySelectorAll(".mermaid")
    });
});