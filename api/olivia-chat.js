import {
  buildConversationContext
} from "../engine/state/conversation-context.js";

import {
  calculateSalesStage
} from "../engine/state/sales-stage.js";

import {
  extractConversationData
} from "../engine/state/memory-extractor.js";

import { generateOliviaResponse } from "../engine/response-engine.js";
import {
  getConversationState,
  updateConversationState
} from "../engine/state/conversation-state.js";


function generateSessionId() {

  return (
    "session_" +
    Date.now() +
    "_" +
    Math.random()
      .toString(36)
      .substring(2, 10)
  );

}



export default async function handler(req, res) {


  if (req.method !== "POST") {

    return res.status(405).json({

      error: "Method not allowed"

    });

  }



  try {


    const {
      message,
      sessionId
    } = req.body;



    if (!message) {

      return res.status(400).json({

        error: "Message required"

      });

    }



    const currentSessionId =
      sessionId || generateSessionId();



    const previousState =
      getConversationState(
        currentSessionId
      );
const extractedData =
      extractConversationData(
        message
      );


const enrichedMemory = {

  ...previousState,

  ...extractedData

};


const conversationContext =
      buildConversationContext(
        enrichedMemory
      );

console.log(
  "OLIVIA CONTEXT:",
  conversationContext
);
const oliviaResponse =
      await generateOliviaResponse(
        message,
        conversationContext
      );


    const newState = {

      profile:
        oliviaResponse.profile
        ||
        previousState.profile
        ||
        null,


      last_intent:
        oliviaResponse.intent,


recommended_villas: (() => {

  const villas =
    extractVillaNames(
      oliviaResponse.response
    );


  return villas.length > 0

    ? villas

    : previousState.recommended_villas || [];

})(),

      travel_dates:
        extractedData.travel_dates
        ||
        previousState.travel_dates
        ||
        null,


guests:
        extractedData.guests
        ||
        previousState.guests
        ||
        null,


trip_type:
        extractedData.trip_type
        ||
        previousState.trip_type
        ||
        null,

      sales_stage:
calculateSalesStage({

  ...previousState,

  ...extractedData,

  profile:
    oliviaResponse.profile,

  last_intent:
    oliviaResponse.intent

})

    };




    updateConversationState(

      currentSessionId,

      newState

    );




    return res.status(200).json({

      ok: true,

      sessionId:
        currentSessionId,


      memory:
        newState,


      ...oliviaResponse

    });


} catch(error) {


    console.error(
      "OLIVIA ERROR:",
      error
    );


    return res.status(500).json({

      error:
        error.message,

      stack:
        error.stack

    });



  }


}




function determineSalesStage(
  intent,
  previousStage
) {


  if (
    intent === "booking_request"
  ) {

    return "ready_to_book";

  }



  if (
    intent === "availability_question"
  ) {

    return "considering_dates";

  }



  if (
    intent === "pricing_question"
  ) {

    return "price_evaluation";

  }



  if (
    intent === "villa_recommendation"
  ) {

    return "discovery";

  }



  return (
    previousStage
    ||
    "new_lead"
  );

}
function extractVillaNames(text) {

  const villas = [
    "Casa Rosada",
    "Atelie Azul",
    "Casa Oca",
    "Casa Manga",
    "Casa Branca",
    "Casa Balões",
    "Casa Grande",
    "Casa Dende"
  ];


  return villas.filter(
    villa =>
      text.includes(villa)
  );

}