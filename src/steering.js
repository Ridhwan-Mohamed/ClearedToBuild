import Phaser from "phaser";

const MAXSPEED = 100;
const MAXAVOIDFORCE = 50;

export function steer(entity, desired){
    let steering = desired.subtract(entity.body.velocity)
    return steering.normalize().scale(MAXSPEED)
}

export function calculateSeparationForce(agent, neighbors) {
    let force = new Phaser.Math.Vector2(0, 0);
    let flag = true;
    neighbors.forEach(neighbor => {
        if (neighbor === agent.body) return; // Ignore itself
        let agentPosition = new Phaser.Math.Vector2(agent.x, agent.y);
        let neighborPosition = new Phaser.Math.Vector2(neighbor.x, neighbor.y);
        let diff = agentPosition.subtract(neighborPosition);        
        let distance = diff.length();
        if (distance < 20) {
            diff.normalize(); // Stronger force when closer
            force.add(diff);
            flag = false
        }
    });
    if(flag){
        return null
    }
    return force.setLength(MAXSPEED);
}


export function avoid(entity, obstacle) {
    const predictionTime = 0.5; // Time ahead for prediction

    // Predict future positions
    const entityFuture = new Phaser.Math.Vector2(
        entity.x + entity.body.velocity.x * predictionTime,
        entity.y + entity.body.velocity.y * predictionTime
    );

    const obstacleFuture = new Phaser.Math.Vector2(
        obstacle.x + obstacle.velocity.x * predictionTime,
        obstacle.y + obstacle.velocity.y * predictionTime
    );

    // Calculate the avoidance vector
    const toObstacle = new Phaser.Math.Vector2(
        obstacleFuture.x - entityFuture.x,
        obstacleFuture.y - entityFuture.y
    );

    const distance = toObstacle.length();

    // If too far away, no avoidance needed
    if (distance > 100) {
        return new Phaser.Math.Vector2(0, 0);
    }

    // Normalize the vector to the obstacle
    toObstacle.normalize();

    // Calculate the obstacle's velocity perpendiculars
    const obstacleVelocity = new Phaser.Math.Vector2(
        obstacle.velocity.x,
        obstacle.velocity.y
    ).normalize();

    const perpendicular1 = new Phaser.Math.Vector2(-obstacleVelocity.y, obstacleVelocity.x); // Left
    const perpendicular2 = new Phaser.Math.Vector2(obstacleVelocity.y, -obstacleVelocity.x); // Right

    // Determine swing direction
    let perpendicularForce;

    // Check if the obstacle is moving directly toward the entity
    const dotProduct = toObstacle.dot(obstacleVelocity);

    if (Math.abs(dotProduct) > 0.9) { 
        // If the obstacle is nearly head-on, randomize the swing
        const direction = Math.random() < 0.5 ? 1 : -1;
        perpendicularForce = direction === 1 ? perpendicular1 : perpendicular2;
    } else {
        // Otherwise, swing in the direction opposite to the obstacle's perpendicular velocity
        perpendicularForce = dotProduct > 0 ? perpendicular2 : perpendicular1;
    }

    // Scale the perpendicular avoidance force
    perpendicularForce = perpendicularForce.scale(MAXAVOIDFORCE);

    return perpendicularForce;
}



