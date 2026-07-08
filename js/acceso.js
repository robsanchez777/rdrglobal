const redirectUrls = {
  member: "calendario.html",
  visitor: "no-pertenece.html"
};

const form = document.getElementById("membershipForm");
const continueButton = document.getElementById("continueButton");

form.addEventListener("change", () => {
  const selectedValue = form.elements.membership.value;

  document.querySelectorAll(".choice-card").forEach((card) => {
    const input = card.querySelector("input");
    card.classList.toggle("is-selected", input.value === selectedValue);
  });

  continueButton.disabled = !selectedValue;
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const selectedValue = form.elements.membership.value;
  const targetUrl = redirectUrls[selectedValue];

  if (targetUrl) {
    window.location.href = targetUrl;
  }
});
