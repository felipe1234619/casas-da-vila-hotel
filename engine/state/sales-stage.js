export function calculateSalesStage(memory) {


  const {

    profile,
    last_intent,
    travel_dates,
    guests,
    selected_villa

  } = memory;



  /*
   * Reserva direta
   */

  if (
    last_intent === "booking_request"
  ) {

    return "booking_ready";

  }



  /*
   * Proposta enviada
   */

  if (
    last_intent === "quotation_request"
  ) {

    return "proposal_sent";

  }



  /*
   * Disponibilidade consultada
   */

  if (
    last_intent === "availability_question"
  ) {

    return "availability_checked";

  }



  /*
   * Casa escolhida pelo hóspede
   */

  if (
    selected_villa
  ) {

    return "villa_selected";

  }



  /*
   * Dados de viagem coletados
   */

  if (
    travel_dates ||
    guests
  ) {

    return "qualification";

  }



  /*
   * Perfil identificado
   */

  if (
    profile
  ) {

    return "discovery";

  }



  /*
   * Primeiro contato
   */

  return "new_lead";

}