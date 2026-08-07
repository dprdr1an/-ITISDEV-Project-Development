require("dotenv").config();

const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const connectDB = require("../config/db");
const User = require("../config/models/User");

const users = require("./users.json");

async function seedUsers() {
    try {
        await connectDB();

        for (const user of users) {
            const exists = await User.findOne({ email: user.email });

            if (!exists) {
                user.password = await bcrypt.hash(user.password, 10);
                await User.create(user);
            }
        }

        console.log("Done!");

        for (const user of users) {
            user.password = await bcrypt.hash(user.password, 10);
        }

        await User.insertMany(users);

        console.log(`✅ Inserted ${users.length} users`);

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

seedUsers();