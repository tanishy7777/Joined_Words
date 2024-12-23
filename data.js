import fs from "fs"
const data = [
        [
            "no",
            "date",
            "clue1",
            "answer1",
            "clue2",
            "answer2",
            "jwclue",
            "joinedword",
            "difficulty"
        ],
        [
            "1",
            "2-13-2022",
            "An important aspect of food",
            "Taste",
            "You might see them on some plants",
            "Buds",
            "We often try to satisfy them",
            "Tastebuds",
            "Medium"
        ],
        [
            "2",
            "2-14-2022",
            "Something you might see in a park",
            "Bench",
            "A Christian Name",
            "Mark",
            "Something people aspire to beat",
            "Benchmark",
            "Medium"
        ],
        [
            "3",
            "2-15-2022",
            "A thing people do almost everyday",
            "Drive",
            "Google Maps helps you find it",
            "Way",
            "It's normally in front of a house or building",
            "Driveway",
            "Easy"
        ],
        [
            "4",
            "2-16-2022",
            "Often seen in the night sky",
            "Moon",
            "We can't see without it",
            "Light",
            "Makes walking on the beach more romantic",
            "Moonlight",
            "Easy"
        ],
        [
            "5",
            "2-17-2022",
            "A thing we do on the internet",
            "Surf",
            "Large companies have one",
            "Board",
            "A beach companion",
            "Surfboard",
            "Medium"
        ],
        [
            "6",
            "2-18-2022",
            "You can get one at a hotel",
            "Dish",
            "Earlier common in taps",
            "Washer",
            "A household appliance",
            "Dishwasher",
            "Medium"
        ],
        [
            "7",
            "2-19-2022",
            "A type of juice",
            "Lime",
            "These type of things are easy to carry",
            "Light",
            "It's nice to be in this at times",
            "Limelight",
            "Medium"
        ],
        [
            "8",
            "2-20-2022",
            "A group of musicians",
            "Band",
            "A dimension",
            "Width",
            "Something that can improve your internet speed",
            "Bandwidth",
            "Easy"
        ],
        [
            "9",
            "2-21-2022",
            "Something that never ends",
            "Loop",
            "Found in old clothes",
            "Hole",
            "Something people tend to exploit",
            "Loophole",
            "Easy"
        ],
        [
            "10",
            "2-22-2022",
            "What remains from a fire",
            "Ash",
            "Used to serve drinks",
            "Tray",
            "Smokers use them",
            "Ashtray",
            "Easy"
        ],
        [
            "11",
            "2-23-2022",
            "A thing you can do with your lips",
            "Whistle",
            "A thing that’s used for cleaning",
            "Blower",
            "A person who warns you",
            "Whistleblower",
            "Medium"
        ],
        [
            "12",
            "2-24-2022",
            "You often have to do this at an airport",
            "Wait",
            "A thing that accompanies shopping",
            "List",
            "This could happen when you try to book a ticket",
            "Waitlist",
            "Medium"
        ],
        [
            "13",
            "2-25-2022",
            "A metal",
            "Gold",
            "Belongs to you",
            "Mine",
            "A treasure",
            "Goldmine",
            "Easy"
        ],
        [
            "14",
            "2-26-2022",
            "We need it when we are in trouble",
            "Help",
            "We often stand in one",
            "Line",
            "A telephone service",
            "Helpline",
            "Easy"
        ],
        [
            "15",
            "2-27-2022",
            "A thing you might use at night",
            "Torch",
            "A word associated with cheque / check",
            "Bearer",
            "A person who leads from the front",
            "Torchbearer",
            "Hard"
        ],
        [
            "16",
            "2-28-2022",
            "What you use a knife for",
            "Cut",
            "Another word for rent",
            "Let",
            "A tasty snack",
            "Cutlet",
            "Easy"
        ],
]


const keys = data[0];

// Transform the data
const result = data.slice(1).map(row => {
    return keys.reduce((acc, key, index) => {
        acc[key] = row[index] || null; // Use null if the value is undefined
        return acc;
    }, {});
});

console.log(result);
// Write the result to a JSON file
fs.writeFile('data.json', JSON.stringify(result, null, 2), (err) => {
    if (err) {
        console.error('Error writing to file:', err);
    } else {
        console.log('Data successfully written to data.json');
    }
});