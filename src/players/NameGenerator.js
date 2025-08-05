export const NameGenerator = {
    firstNames: [
        'Aaliyah', 'Mateo', 'Sakura', 'Omar', 'Zara',
        'Kofi', 'Anika', 'Wei', 'Dimitri', 'Fatima',
        'Noor', 'Diego', 'Yara', 'Min-Jun', 'Chloe',
        'Amir', 'Leila', 'Ibrahim', 'Tariq', 'Mei',
        'Ravi', 'Soraya', 'Niko', 'Lucía', 'Jin',
        'Adanna', 'Liam', 'Nadia', 'Haruto', 'Elsa',
        'Ayana', 'Sven', 'Zainab', 'Théo', 'Ren', 
        'Sofia', 'Arjun', 'Hana', 'Milo', 'Sanaa'
    ],

    lastNames: [
        'Okafor', 'Fernandez', 'Nguyen', 'Kowalski', 'Kim',
        'Patel', 'Dubois', 'Abdullah', 'Takahashi', 'Singh',
        'Almeida', 'Nakamura', 'Mensah', 'Yilmaz', 'O’Sullivan',
        'Chowdhury', 'Petrov', 'Garcia', 'Zhou', 'Bakker',
        'Moreno', 'Da Silva', 'Toure', 'Leclerc', 'Rahman',
        'Rossi', 'Mwangi', 'Chen', 'Ahmadi', 'Bautista',
        'Kaur', 'Dlamini', 'López', 'Müller', 'Nasr',
        'El-Sayed', 'Ivanova', 'Hashimoto', 'Dubey', 'Almasi'
    ],

    generate() {
        const first = Phaser.Math.RND.pick(this.firstNames);
        const last = Phaser.Math.RND.pick(this.lastNames);
        return `${first} ${last}`;
    }
};
