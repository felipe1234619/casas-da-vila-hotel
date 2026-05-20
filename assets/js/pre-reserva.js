(function () {
  const WHATSAPP_NUMBER = "5573991435522";

  const form = document.getElementById("preBookingForm");
  const statusEl = document.getElementById("formStatus");
  const whatsappBtn = document.getElementById("whatsappBtn");
  const emailBtn = document.getElementById("emailBtn");

  function getFormData(form) {
    const fd = new FormData(form);

    return {
      payer_name: fd.get("payer_name")?.trim(),
      payer_document: fd.get("payer_document")?.trim(),
      payer_email: fd.get("payer_email")?.trim(),
      payer_phone: fd.get("payer_phone")?.trim(),

      unit_name: fd.get("unit_name"),
      checkin: fd.get("checkin"),
      checkout: fd.get("checkout"),
      guests_count: fd.get("guests_count"),
      guests: fd.get("guests")?.trim(),
      children: fd.get("children")?.trim(),
      notes: fd.get("notes")?.trim(),

      payer_declaration_accepted: fd.get("payer_declaration_accepted") === "on",
      policy_accepted: fd.get("policy_accepted") === "on",
      non_refundable_accepted: fd.get("non_refundable_accepted") === "on"
    };
  }

  function buildWhatsAppMessage(data, ref) {
    return [
      "Nova solicitação de pré-reserva — Casas da Vila",
      "",
      `Referência: ${ref}`,
      "",
      "Responsável financeiro:",
      data.payer_name,
      "",
      "CPF/CNPJ:",
      data.payer_document,
      "",
      "E-mail:",
      data.payer_email,
      "",
      "WhatsApp:",
      data.payer_phone,
      "",
      "Casa desejada:",
      data.unit_name,
      "",
      "Check-in:",
      data.checkin,
      "",
      "Check-out:",
      data.checkout,
      "",
      "Número de hóspedes:",
      data.guests_count,
      "",
      "Hóspedes:",
      data.guests,
      "",
      "Crianças e idades:",
      data.children || "-",
      "",
      "Observações:",
      data.notes || "-",
      "",
      "Declarações:",
      "Responsável financeiro: SIM",
      "Pagamento pelo CPF/CNPJ informado: SIM",
      "Ciente de que comprovante não confirma reserva: SIM",
      "Ciente de tarifa não reembolsável após confirmação: SIM"
    ].join("\n");
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const data = getFormData(form);

    statusEl.textContent = "Registrando sua pré-reserva...";

    try {
      const response = await fetch("/api/pre-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Erro ao registrar pré-reserva");
      }

      const message = buildWhatsAppMessage(data, result.booking_reference);
      const encoded = encodeURIComponent(message);

      const whatsappUrl =
        `https://wa.me/${WHATSAPP_NUMBER}?text=${encoded}`;

      const emailSubject =
        encodeURIComponent(
          `Pré-reserva ${result.booking_reference} — Casas da Vila`
        );

      const emailUrl =
        `mailto:reservas@casasdavila.com?subject=${emailSubject}&body=${encoded}`;

      whatsappBtn.href = whatsappUrl;
      emailBtn.href = emailUrl;

      whatsappBtn.style.display = "inline-flex";
      emailBtn.style.display = "inline-flex";

      statusEl.innerHTML =
        "Pré-reserva registrada. Escolha como deseja enviar a solicitação.";

    } catch (error) {
      console.error(error);

      statusEl.textContent =
        "Não foi possível registrar a pré-reserva. Por favor, revise os dados ou tente novamente.";
    }
  });
})();