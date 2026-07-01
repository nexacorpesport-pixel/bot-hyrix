module.exports = {

    PANEL_CHANNEL: "1501626016815382669",
    TEST_MODO_ROLE: "1501625955427422378", // Ton rôle Test Modérateur

    CATEGORIES: {
        staff: "1521924264238780559",
        joueur: "1521924347227410565",
        audiovisuel: "1521924438113779922",
        aide: "1521924495101923569",
        partenariat: "1521924558737768643",
        autre: "1521924607106482196"
    },

    ROLES: {
        staff: ["1505330692106485781", "1505330696619688027", "1505330697806811271"],
        joueur: ["1505330692106485781", "1505330696619688027", "1505330697806811271", "1505330699752706269", "1505330700654477403"],
        audiovisuel: ["1505330692106485781", "1505330696619688027", "1505330697806811271"],
        aide: ["1505330692106485781", "1505330696619688027", "1505330697806811271"],
        autre: ["1505330692106485781", "1505330696619688027", "1505330697806811271"]
    },

    // Rôles spécifiques Audiovisuel (Exemples d'IDs à adapter si tu veux les donner automatiquement)
    AUDIO_ROLES: {
        monteur: "1505330702793576568", 
        graphiste: "1505330702793576568",
        mapper: "1505330702793576568",
        maker: "1505330702793576568",
        caster: "1505330702793576568"
    },

    PR_ROLES: [
        { min: 0, max: 20, role: "1501920524547133560", name: "GRINDER 5" },
        { min: 20, max: 40, role: "1501920490107965620", name: "GRINDER 4" },
        { min: 40, max: 60, role: "1501920467475239013", name: "GRINDER 3" },
        { min: 60, max: 80, role: "1501920444054376448", name: "GRINDER 2" },
        { min: 80, max: 100, role: "1501920404686635008", name: "GRINDER 1" },
        { min: 100, max: 350, role: "1501920362491936818", name: "ESPOIR" },
        { min: 350, max: 1000, role: "1501625971420434515", name: "ACADEMIE" },
        { min: 1000, max: 999999, role: "1501625970564534304", name: "JOUEUR OFFICIEL" }
    ]
};
