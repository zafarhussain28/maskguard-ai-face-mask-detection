"""
train_model.py
==============
Train a face mask classifier using MobileNetV2 transfer learning.
Much more accurate than a custom CNN on small datasets.

Usage:
    python src/train_model.py

The trained model is saved to  models/mask_detector.keras
A plot of accuracy / loss curves is saved to  models/training_plot.png
"""

import os
import numpy as np
import matplotlib
matplotlib.use("Agg")                       # non-interactive backend
import matplotlib.pyplot as plt

from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.models import Model
from tensorflow.keras.layers import (
    Dense, Dropout, GlobalAveragePooling2D, Input
)
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau

# ─── Configuration ────────────────────────────────────────────────────────────
IMG_SIZE        = 224
BATCH_SIZE      = 16
EPOCHS          = 25
LEARNING_RATE   = 1e-4          # small LR for fine-tuning

# Resolve paths relative to the project root (one level up from src/)
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATASET_ROOT = os.path.join(PROJECT_ROOT, "dataset")
TRAIN_DIR    = os.path.join(DATASET_ROOT, "Train")
VAL_DIR      = os.path.join(DATASET_ROOT, "Validation")
TEST_DIR     = os.path.join(DATASET_ROOT, "Test")
MODEL_DIR    = os.path.join(PROJECT_ROOT, "models")
MODEL_PATH   = os.path.join(MODEL_DIR, "mask_detector.keras")
PLOT_PATH    = os.path.join(MODEL_DIR, "training_plot.png")


def build_generators():
    """Create ImageDataGenerators with augmentation for training."""

    train_datagen = ImageDataGenerator(
        rescale=1.0 / 255.0,
        rotation_range=20,
        width_shift_range=0.2,
        height_shift_range=0.2,
        shear_range=0.15,
        zoom_range=0.15,
        horizontal_flip=True,
        fill_mode="nearest",
    )

    val_test_datagen = ImageDataGenerator(rescale=1.0 / 255.0)

    train_gen = train_datagen.flow_from_directory(
        TRAIN_DIR,
        target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        class_mode="binary",
        shuffle=True,
    )

    val_gen = val_test_datagen.flow_from_directory(
        VAL_DIR,
        target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        class_mode="binary",
        shuffle=False,
    )

    test_gen = val_test_datagen.flow_from_directory(
        TEST_DIR,
        target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        class_mode="binary",
        shuffle=False,
    )

    return train_gen, val_gen, test_gen


def build_model():
    """
    Build a classifier using MobileNetV2 as the feature extractor.
    Only the top classification layers are trained initially.
    """

    # Load MobileNetV2 pre-trained on ImageNet, without its top classifier
    base_model = MobileNetV2(
        weights="imagenet",
        include_top=False,
        input_shape=(IMG_SIZE, IMG_SIZE, 3),
    )

    # Freeze the base model — we only train the new head
    base_model.trainable = False

    # Build a new classification head
    inputs  = Input(shape=(IMG_SIZE, IMG_SIZE, 3))
    x       = base_model(inputs, training=False)
    x       = GlobalAveragePooling2D()(x)
    x       = Dense(128, activation="relu")(x)
    x       = Dropout(0.5)(x)
    outputs = Dense(1, activation="sigmoid")(x)

    model = Model(inputs, outputs)

    model.compile(
        optimizer=Adam(learning_rate=LEARNING_RATE),
        loss="binary_crossentropy",
        metrics=["accuracy"],
    )
    return model


def plot_history(history):
    """Save training / validation accuracy & loss curves."""

    epochs_range = range(1, len(history.history["accuracy"]) + 1)
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

    ax1.plot(epochs_range, history.history["accuracy"],     label="Train Accuracy")
    ax1.plot(epochs_range, history.history["val_accuracy"], label="Val Accuracy")
    ax1.set_title("Training & Validation Accuracy")
    ax1.set_xlabel("Epoch")
    ax1.set_ylabel("Accuracy")
    ax1.legend()
    ax1.grid(True, alpha=0.3)

    ax2.plot(epochs_range, history.history["loss"],     label="Train Loss")
    ax2.plot(epochs_range, history.history["val_loss"], label="Val Loss")
    ax2.set_title("Training & Validation Loss")
    ax2.set_xlabel("Epoch")
    ax2.set_ylabel("Loss")
    ax2.legend()
    ax2.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig(PLOT_PATH, dpi=150)
    print(f"[INFO] Training plot saved to {PLOT_PATH}")


def main():
    os.makedirs(MODEL_DIR, exist_ok=True)

    # ── Data generators ───────────────────────────────────────────────────
    print("[INFO] Loading dataset …")
    train_gen, val_gen, test_gen = build_generators()
    print(f"[INFO] Class indices: {train_gen.class_indices}")
    print(f"[INFO] Training samples  : {train_gen.samples}")
    print(f"[INFO] Validation samples: {val_gen.samples}")
    print(f"[INFO] Test samples      : {test_gen.samples}")

    # ── Build model ───────────────────────────────────────────────────────
    print("\n[INFO] Building MobileNetV2 transfer-learning model …")
    model = build_model()
    model.summary()

    callbacks = [
        EarlyStopping(monitor="val_loss", patience=5, restore_best_weights=True),
        ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=3, verbose=1),
    ]

    # ── Train ─────────────────────────────────────────────────────────────
    print("\n[INFO] Training model …")
    history = model.fit(
        train_gen,
        validation_data=val_gen,
        epochs=EPOCHS,
        callbacks=callbacks,
    )

    # ── Evaluate ──────────────────────────────────────────────────────────
    print("\n[INFO] Evaluating on test set …")
    test_loss, test_acc = model.evaluate(test_gen)
    print(f"[RESULT] Test Loss     : {test_loss:.4f}")
    print(f"[RESULT] Test Accuracy : {test_acc:.4f}")

    # ── Save ──────────────────────────────────────────────────────────────
    model.save(MODEL_PATH)
    print(f"[INFO] Model saved to {MODEL_PATH}")

    plot_history(history)
    print("\n✅  Training complete!")


if __name__ == "__main__":
    main()
