export function extractConversationData(message) {

  const text = message.toLowerCase();


  const data = {};



  // =========================
  // HÓSPEDES
  // =========================


  if (
    text.includes("casal") ||
    text.includes("dois") ||
    text.includes("2 pessoas") ||
    text.includes("2 hóspedes") ||
    text.includes("two")
  ) {

    data.guests = 2;

  }


  if (
    text.includes("três") ||
    text.includes("tres") ||
    text.includes("3 pessoas") ||
    text.includes("3 hóspedes") ||
    text.includes("three")
  ) {

    data.guests = 3;

  }


  if (
    text.includes("quatro") ||
    text.includes("4 pessoas") ||
    text.includes("4 hóspedes") ||
    text.includes("four")
  ) {

    data.guests = 4;

  }




  // =========================
  // TIPO DE VIAGEM
  // =========================


  if (
    text.includes("lua de mel") ||
    text.includes("honeymoon")
  ) {

    data.trip_type = "honeymoon";

  }


  else if (
    text.includes("aniversário") ||
    text.includes("celebração") ||
    text.includes("celebration")
  ) {

    data.trip_type = "celebration";

  }


  else if (
    text.includes("descanso") ||
    text.includes("tranquilo") ||
    text.includes("tranquila") ||
    text.includes("relax")
  ) {

    data.trip_type = "relaxation";

  }




  // =========================
  // DATAS
  // =========================


  const datePattern =
    /(\d{1,2})[\/\-](\d{1,2})/g;


  const dates =
    [...text.matchAll(datePattern)];



  if (dates.length >= 2) {


    data.travel_dates = {

      checkin:
        dates[0][0],

      checkout:
        dates[1][0]

    };

  }




  return data;

}