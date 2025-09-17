const drawParticipants = (participants) => {
  const n = participants.length;
  const shuffledIndexes = [...Array(n).keys()];

  // Mélange initial
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * i);
    [shuffledIndexes[i], shuffledIndexes[j]] = [
      shuffledIndexes[j],
      shuffledIndexes[i],
    ];
  }

  // Correction des auto-attributions
  for (let i = 0; i < n; i++) {
    if (shuffledIndexes[i] === i) {
      // Trouver un autre index à échanger
      for (let j = 0; j < n; j++) {
        if (j !== i && shuffledIndexes[j] !== j && shuffledIndexes[j] !== i) {
          [shuffledIndexes[i], shuffledIndexes[j]] = [
            shuffledIndexes[j],
            shuffledIndexes[i],
          ];
          break;
        }
      }
    }
  }

  participants.forEach((giver, i) => {
    const receiverIndex = shuffledIndexes[i];
    const receiver = participants[receiverIndex];

    giver.assignedTo = receiver.participant.user;
    receiver.assignedBy = giver.participant.user;
  });
};

module.exports = { drawParticipants };
