// Generated from rules/gorgias.json and rules/categories.json by `npm run rules`. Do not edit.
export const GORGIAS = {
  "$comment": "How the checker reads a Gorgias view export. Edit this file, then run `npm run rules` so the page and the CLI pick it up. Header names and AI Agent tags come from a Gorgias trial account (Nov 2, 2026) and the Gorgias docs. Anything marked UNVERIFIED has not been seen in a real export with AI Agent traffic.",
  "version": "2026-11-16.1",
  "headers": {
    "ticketId": {
      "names": [
        "Ticket id"
      ],
      "required": true
    },
    "tags": {
      "names": [
        "Tags"
      ],
      "required": true
    },
    "subject": {
      "names": [
        "Subject"
      ],
      "required": false
    },
    "closedAt": {
      "names": [
        "Closed date"
      ],
      "required": false
    },
    "aiOutcomeField": {
      "names": [
        "Ticket Field: AI Agent Outcome"
      ],
      "required": false,
      "note": "Values UNVERIFIED."
    },
    "contactReason": {
      "names": [
        "Ticket Field: Contact reason"
      ],
      "required": false,
      "note": "Account-specific dropdown; used as extra text for categories. UNVERIFIED in real data."
    },
    "firstMessage": {
      "names": [],
      "required": false,
      "note": "A view export has no message text. Left empty until a real export with a first-message column is seen."
    }
  },
  "tagSeparator": ",",
  "tagSeparatorNote": "UNVERIFIED: commas assumed, as in the Closewell importer.",
  "ai": {
    "closeTags": [
      "ai_close"
    ],
    "handoverTags": [
      "ai_handover"
    ],
    "otherTags": [
      "ai_snooze",
      "ai_processing",
      "ai_answered"
    ],
    "ignoreTags": [
      "ai_ignore"
    ],
    "notes": {
      "ai_close": "AI Agent resolved the ticket on its own (Gorgias docs).",
      "ai_handover": "AI Agent handed the ticket to the team. Wins over ai_close: a handover means a human got the ticket.",
      "ai_snooze": "AI Agent snoozed the ticket waiting for the customer.",
      "ai_processing": "AI Agent is still working on the ticket.",
      "ai_answered": "UNVERIFIED on the trial; in the Gorgias docs. AI replied but neither closed nor handed over.",
      "ai_ignore": "AI Agent skipped the ticket (a rule told it not to answer). Not counted as AI-handled."
    },
    "outcomeField": {
      "note": "UNVERIFIED guess at 'AI Agent Outcome' values, used only when a ticket has no AI tag.",
      "closeWords": [
        "close",
        "resolv",
        "automat"
      ],
      "handoverWords": [
        "handover",
        "hand over",
        "handoff"
      ]
    }
  }
};

export const CATEGORIES = {
  "$comment": "Keyword and tag rules for categories. Matching is lowercase with word boundaries on the subject, tags and (when the export has it) the first customer message. A trailing * matches any word ending (refund* matches refunded, refunds). A ticket gets the first matching category in `priority`. Edit this file, then run `npm run rules`.",
  "version": "2026-11-16.1",
  "priority": [
    "damage_missing_wrong",
    "order_change",
    "return_exchange",
    "warranty",
    "subscription",
    "wismo",
    "other"
  ],
  "needsBackendAction": [
    "damage_missing_wrong",
    "order_change",
    "return_exchange",
    "warranty",
    "subscription"
  ],
  "labels": {
    "damage_missing_wrong": "Damaged, missing or wrong item",
    "order_change": "Order change or cancellation",
    "return_exchange": "Return, exchange or refund",
    "warranty": "Warranty or faulty product",
    "subscription": "Subscription change",
    "wismo": "Where is my order",
    "other": "Everything else"
  },
  "tags": {
    "$comment": "Gorgias tags (lowercased, spaces and hyphens become _) that map straight to a category. Tags are account-specific; these are common names. A bare `cancellation` tag is left out on purpose: it is used for both orders and subscriptions, so the subject decides.",
    "damage_missing_wrong": [
      "damaged",
      "damaged_item",
      "damaged_order",
      "missing_item",
      "missing_items",
      "wrong_item",
      "lost_package",
      "not_received"
    ],
    "order_change": [
      "order_change",
      "order_edit",
      "address_change",
      "change_address",
      "cancel_order",
      "order_cancellation"
    ],
    "return_exchange": [
      "return",
      "returns",
      "exchange",
      "exchanges",
      "refund",
      "refunds",
      "return_request"
    ],
    "warranty": [
      "warranty",
      "warranty_claim",
      "defective",
      "faulty"
    ],
    "subscription": [
      "subscription",
      "subscriptions",
      "subscription_cancellation",
      "cancel_subscription",
      "recharge",
      "skio"
    ],
    "wismo": [
      "wismo",
      "order_status",
      "where_is_my_order",
      "shipping_status",
      "tracking"
    ]
  },
  "keywords": {
    "en": {
      "basic": false,
      "damage_missing_wrong": [
        "damaged",
        "damage",
        "broken",
        "cracked",
        "shattered",
        "smashed",
        "dented",
        "leaking",
        "leaked",
        "missing",
        "never arrived",
        "never received",
        "not received",
        "didn't receive",
        "did not receive",
        "haven't received",
        "have not received",
        "lost package",
        "lost parcel",
        "package lost",
        "parcel lost",
        "stolen",
        "marked as delivered",
        "says delivered",
        "wrong item*",
        "wrong product*",
        "wrong order",
        "wrong size",
        "wrong colour",
        "wrong color",
        "incorrect item*",
        "sent the wrong",
        "sent me the wrong",
        "received the wrong",
        "not what i ordered"
      ],
      "order_change": [
        "change my order",
        "change order",
        "change the order",
        "edit my order",
        "modify my order",
        "update my order",
        "change my address",
        "change address",
        "change the address",
        "change shipping address",
        "change my shipping address",
        "update my shipping address",
        "change delivery address",
        "change my delivery address",
        "update my address",
        "update address",
        "wrong address",
        "add an item",
        "add to my order",
        "add item*",
        "remove an item",
        "remove item*",
        "cancel my order",
        "cancel order",
        "cancel the order",
        "order cancellation"
      ],
      "return_exchange": [
        "return",
        "returns",
        "returning",
        "returned",
        "refund*",
        "exchange*",
        "send it back",
        "send back",
        "money back",
        "return label"
      ],
      "warranty": [
        "warranty",
        "guarantee",
        "stopped working",
        "stops working",
        "doesn't work",
        "does not work",
        "not working",
        "defect*",
        "faulty",
        "malfunction*",
        "repair*"
      ],
      "subscription": [
        "subscription*",
        "subscribe",
        "subscribed",
        "skip my next",
        "skip next",
        "skip a month",
        "pause my",
        "renewal",
        "recurring",
        "next shipment",
        "next box",
        "autoship",
        "auto-ship",
        "membership"
      ],
      "wismo": [
        "where is my order",
        "where's my order",
        "wheres my order",
        "where is my package",
        "where is my parcel",
        "wismo",
        "tracking",
        "track my",
        "order status",
        "status of my order",
        "hasn't arrived",
        "has not arrived",
        "not arrived yet",
        "still waiting",
        "shipping update",
        "delivery date",
        "eta",
        "not shipped",
        "shipped yet",
        "when will my order"
      ]
    },
    "de": {
      "basic": true,
      "damage_missing_wrong": [
        "beschädigt",
        "kaputt",
        "zerbrochen",
        "fehlt",
        "fehlend*",
        "nicht erhalten",
        "nie angekommen",
        "falscher artikel",
        "falsche artikel",
        "falsches produkt",
        "falsche größe"
      ],
      "order_change": [
        "bestellung ändern",
        "adresse ändern",
        "lieferadresse ändern",
        "bestellung stornieren",
        "stornier*"
      ],
      "return_exchange": [
        "rücksendung",
        "retour*",
        "rückerstattung",
        "erstattung",
        "umtausch*",
        "zurückschicken",
        "geld zurück"
      ],
      "warranty": [
        "garantie",
        "gewährleistung",
        "funktioniert nicht",
        "defekt",
        "reparatur"
      ],
      "subscription": [
        "abo",
        "abonnement*"
      ],
      "wismo": [
        "wo ist meine bestellung",
        "sendungsverfolgung",
        "lieferstatus",
        "wann kommt"
      ]
    },
    "fr": {
      "basic": true,
      "damage_missing_wrong": [
        "endommagé*",
        "cassé*",
        "abîmé*",
        "manquant*",
        "mauvais article",
        "mauvais produit",
        "pas reçu",
        "jamais reçu"
      ],
      "order_change": [
        "modifier ma commande",
        "changer ma commande",
        "changer d'adresse",
        "changer l'adresse",
        "annuler ma commande",
        "annulation"
      ],
      "return_exchange": [
        "retour*",
        "rembours*",
        "échange*",
        "renvoyer"
      ],
      "warranty": [
        "garantie",
        "ne fonctionne pas",
        "ne marche pas",
        "défectueu*"
      ],
      "subscription": [
        "abonnement*"
      ],
      "wismo": [
        "où est ma commande",
        "ou est ma commande",
        "suivi de commande",
        "numéro de suivi"
      ]
    },
    "es": {
      "basic": true,
      "damage_missing_wrong": [
        "dañad*",
        "roto",
        "rota",
        "rotos",
        "rotas",
        "falta*",
        "artículo equivocado",
        "producto equivocado",
        "no recibí",
        "nunca llegó"
      ],
      "order_change": [
        "cambiar mi pedido",
        "modificar mi pedido",
        "cambiar la dirección",
        "cancelar mi pedido",
        "cancelar el pedido"
      ],
      "return_exchange": [
        "devolución",
        "devoluciones",
        "devolver",
        "reembols*"
      ],
      "warranty": [
        "garantía",
        "garantia",
        "no funciona",
        "defectuos*"
      ],
      "subscription": [
        "suscripción",
        "suscripcion"
      ],
      "wismo": [
        "dónde está mi pedido",
        "donde esta mi pedido",
        "seguimiento",
        "número de seguimiento"
      ]
    },
    "nl": {
      "basic": true,
      "damage_missing_wrong": [
        "beschadigd",
        "kapot",
        "gebroken",
        "ontbreekt",
        "ontbrekend*",
        "verkeerd artikel",
        "verkeerde artikel",
        "niet ontvangen"
      ],
      "order_change": [
        "bestelling wijzigen",
        "adres wijzigen",
        "bestelling annuleren"
      ],
      "return_exchange": [
        "retour*",
        "terugbetal*",
        "ruilen",
        "terugsturen",
        "geld terug"
      ],
      "warranty": [
        "garantie",
        "werkt niet",
        "defect"
      ],
      "subscription": [
        "abonnement*"
      ],
      "wismo": [
        "waar is mijn bestelling",
        "track en trace",
        "track & trace",
        "bezorgstatus"
      ]
    }
  }
};

export const RULES = { gorgias: GORGIAS, categories: CATEGORIES };
