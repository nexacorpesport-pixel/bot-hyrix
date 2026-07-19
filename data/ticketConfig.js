module.exports = {
    // Identifiant du salon où le bot va afficher le panneau des tickets
    PANEL_CHANNEL: "1528184702643470474", 

    // Les catégories Discord où s'ouvriront les tickets (Remplis avec tes IDs de catégories)
    CATEGORIES: {
        staff: "1528215216607858708",
        joueur: "1521924347227410565",
        audiovisuel: "1521924438113779922",
        aide: "1521924495101923569",
        partenariat: "1521924558737768643"
    },

    // Rôle attribué automatiquement pour la commande "+test modérateur"
    TEST_MODO_ROLE: "1528184626021929082",

    // Mapping exact de tes rôles Staff par catégorie (Configuré avec tes IDs reçus)
    ROLES: {
        staff: [
            "1528184664693538978", 
            "1528184649304772742", 
            "1528184647035392182", 
            "1528184645269586051", 
            "1528184641868271658", // <-- Virgule ajoutée ici
            "1528184639905202206"
        ],
        joueur: [
            "1528184664693538978", 
            "1528184649304772742", 
            "1528184647035392182", 
            "1528184645269586051", 
            "1528184641868271658", // <-- Virgule ajoutée ici
            "1528184639905202206", // <-- Virgule ajoutée ici
            "1528184635345997885", 
            "1528184629784477737", 
            "1528184628035190886"
        ],
        audiovisuel: [
            "1528184664693538978", 
            "1528184649304772742", 
            "1528184647035392182", 
            "1528184645269586051", 
            "1528184641868271658", // <-- Virgule ajoutée ici
            "1528184639905202206"
        ],
        aide: [
            "1528184664693538978", 
            "1528184649304772742", 
            "1528184647035392182", 
            "1528184645269586051", 
            "1528184641868271658", // <-- Virgule ajoutée ici
            "1528184639905202206"
        ],
        partenariat: [
            "1528184664693538978", 
            "1528184649304772742", 
            "1528184647035392182", 
            "1528184645269586051", 
            "1528184641868271658", // <-- Virgule ajoutée ici
            "1528184639905202206"
        ]
    }
};