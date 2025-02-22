const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const Video = sequelize.define('Video', {
    id: {
        type: DataTypes.UUID, 
        defaultValue: uuidv4,  
        primaryKey: true
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    uploaded_by: {
        type: DataTypes.STRING,
        allowNull: false
    },
    summary_file_id: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    audio_file_id: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    filepath: {
        type: DataTypes.STRING,
        allowNull: false
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: 'pending',
        allowNull: true
    }
}, {
    timestamps: true
});

module.exports = Video;
