import fs from "fs";
import path from "path";

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }


  try {

    const body = req.body || {};

    const message = body.message || "";

    const knowledgePath = path.join(
      process.cwd(),
      "knowledge"
    );


    const inventory = JSON.parse(
      fs.readFileSync(
        path.join(
          knowledgePath,
          "inventory.json"
        ),
        "utf8"
      )
    );


    const behaviorPath = path.join(
      process.cwd(),
      "behavior"
    );


    const playbook = JSON.parse(
      fs.readFileSync(
        path.join(
          behaviorPath,
          "conversation_playbook.json"
        ),
        "utf8"
      )
    );


    return res.status(200).json({

      ok: true,

      assistant: "Olivia",

      received_message: message,

      knowledge_loaded: true,

      behavior_loaded: true,

      inventory_villas:
        inventory.villas.length,

      next_step:
        "Connect response generation engine"

    });


  } catch(error){

    return res.status(500).json({

      error: error.message

    });

  }

}