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
        staff: ["1501625944148934758", "1521928409268228096", "1501625946661191690"],
        joueur: ["1501625944148934758", "1521928409268228096", "1501625946661191690", "1501625948125003917", "1501625950952227018"],
        audiovisuel: ["1501625944148934758", "1521928409268228096", "1501625946661191690"],
        aide: ["1501625944148934758", "1521928409268228096", "1501625946661191690"],
        autre: ["1501625944148934758", "1521928409268228096", "1501625946661191690"]
    },

    // Rôles spécifiques Audiovisuel (Exemples d'IDs à adapter si tu veux les donner automatiquement)
    AUDIO_ROLES: {
        monteur: "1501625965498073169", 
        graphiste: "1501625964524863598",
        mapper: "1501625968295542955",
        maker: "1501625966324351116",
        caster: "1501625967259418707"
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
