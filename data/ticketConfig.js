module.exports = {

    PANEL_CHANNEL: "1505330772343656680",
    TEST_MODO_ROLE: "1505330702793576568", // Ton rôle Test Modérateur

    CATEGORIES: {
        staff: "1505559323105951744",
        joueur: "1505559260975595753",
        audiovisuel: "1506771653621710848",
        aide: "1505559399442284605",
        partenariat: "1506771703769071726",
        autre: "1506771703769071726"
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
        { min: 0, max: 20, role: "1505330730262200382", name: "GRINDER 5" },
        { min: 20, max: 40, role: "1505330728655913113", name: "GRINDER 4" },
        { min: 40, max: 60, role: "1505330726185341079", name: "GRINDER 3" },
        { min: 60, max: 80, role: "1505330724063019132", name: "GRINDER 2" },
        { min: 80, max: 100, role: "1505330723010248806", name: "GRINDER 1" },
        { min: 100, max: 350, role: "1505330720380420219", name: "ESPOIR" },
        { min: 350, max: 1000, role: "1505330715938525204", name: "ACADEMIE" },
        { min: 1000, max: 999999, role: "1505330713891963061", name: "JOUEUR OFFICIEL" }
    ]
};
