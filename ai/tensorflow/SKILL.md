---
name: tensorflow
description: Use when building, training, evaluating, optimizing, or debugging deep learning models in TensorFlow 2.x and modern Keras 3, encountering input pipeline bottlenecks, OOM errors, NaN loss, model saving/serialization deprecations, or migrating legacy Keras/TF code.
---

# TensorFlow & Modern Keras Engineering Playbook

## Overview

A unified engineering guide for building, training, optimizing, and deploying deep learning models using modern TensorFlow (2.16+) and Keras 3.

**Core principle:** **Treat TensorFlow as a hardware-accelerated graph compiler and dataflow engine.** Construct static, high-throughput `tf.data` pipelines that eliminate GPU starvation, define declarative network graphs using explicit `keras.layers.Input` specifications, leverage numerically stable loss formulations (`from_logits=True`), enforce `dtype="float32"` on output layers under mixed precision, and encapsulate custom training dynamics inside subclassed `keras.Model` methods (`call`, `train_step`, `test_step`) or compiled `@tf.function` scopes.

---

## When to Use

### Use When:
- Building neural network architectures across tabular, vision, sequence, or generative domains (ANNs/MLPs, CNNs, ResNets, Transposed CNNs, VAEs, GANs).
- Constructing high-throughput, non-blocking data input pipelines using `tf.data.Dataset` with parallel map, batching, caching, and prefetching.
- Training models with production callbacks: early stopping with weight restoration, learning rate scheduling/reduction on plateaus, and best checkpoint retention.
- Implementing custom forward dynamics, custom layers (e.g., stochastic reparameterization), or composite multi-term losses (e.g., Reconstruction + KL Divergence).
- Running adversarial or multi-optimizer updates using `tf.GradientTape()` with gradient clipping.
- Optimizing GPU hardware utilization via dynamic memory growth, mixed precision (`mixed_float16`), XLA compilation (`jit_compile=True`), or `tf.distribute.MirroredStrategy`.
- Saving and loading models across environments using native zipped `.keras` archives and registering custom layers via `@keras.saving.register_keras_serializable()`.
- Migrating legacy TensorFlow 1.x/2.x code (such as `ImageDataGenerator`, `.h5` files, or raw eager loops) to modern Keras 3 standards.

### When NOT to Use:
- Running standard tabular algorithms where deep learning is unwarranted; prefer `scikit-learn`, `LightGBM`, or `XGBoost`.
- Pure PyTorch-native research codebases without Keras cross-backend requirements (use `pytorch` skill).
- Serving pre-trained Large Language Models with specialized KV-cache managers (use dedicated serving runtimes like `vLLM` or `TensorRT-LLM`).

---

## Quick Reference

| Area | Modern Standard (TF 2.16+ / Keras 3) | Legacy / Anti-Pattern | Critical Rationale |
|---|---|---|---|
| **Model Saving** | `model.save("model.keras")` / `keras.models.load_model("model.keras")` | `model.save("model.h5")` or legacy SavedModel folders | `.keras` is a self-contained, zip-based modern archive preserving full config, weights, and optimizer state across backends. |
| **Custom Layers** | Decorate with `@keras.saving.register_keras_serializable(package="custom")` | Unregistered custom classes relying on brittle Python bytecode | Ensures seamless serialization and deserialization in `.keras` archives without custom loader dictionaries. |
| **Model Inputs** | `model = Sequential([keras.layers.Input(shape=(H, W, C)), ...])` | Passing `input_shape=(H, W, C)` to the first hidden layer | Avoids deprecation warnings in Keras 3 and guarantees immediate variable allocation and deterministic shape inference. |
| **Image ETL** | `tf.keras.utils.image_dataset_from_directory()` + `tf.data` | `ImageDataGenerator` / `flow_from_directory` | `ImageDataGenerator` is deprecated, runs synchronously on the Python thread, and bottlenecks GPU throughput. |
| **Data Pipelining** | `dataset.cache().shuffle(buf).batch(B).prefetch(tf.data.AUTOTUNE)` | Unbuffered Python iterators or reading raw NumPy in `model.fit` | Overlaps CPU data preprocessing with GPU forward/backward compute via DMA background transfers. |
| **Loss Numerical Stability** | `Dense(units)` + `Crossentropy(from_logits=True)` | Output `activation="softmax/sigmoid"` + `Crossentropy(from_logits=False)` | Computing softmax/sigmoid combined with crossentropy in a single log-sum-exp kernel avoids numerical underflow and NaN gradients. |
| **Mixed Precision** | `keras.mixed_precision.set_global_policy("mixed_float16")` + `Dense(C, dtype="float32")` | Standard FP32 on Tensor Cores, or FP16 output layer without explicit float32 casting | Doubles throughput on Tensor Cores; explicit `float32` output prevents catastrophic underflow during loss calculation. |
| **Custom Training Step** | Subclass `keras.Model`, implement `call`, `train_step`, and `test_step` | Overriding only `train_step` or using raw Python `while` loops | Omitting `call` and `test_step` crashes `model.evaluate()` and validation in `model.fit()`. Subclassing preserves callbacks and progress bars. |
| **Low-Level Loops** | `@tf.function` decorating step function with `tf.GradientTape()` | Eager execution inside training loops without `@tf.function` | `@tf.function` traces computation into an optimized TensorFlow execution graph, reducing Python VM dispatch overhead by 10x-50x. |
| **Gradient Clipping** | `optimizer = keras.optimizers.Adam(clipnorm=1.0)` | Unbounded gradients or manual uncompiled clipping | Prevents exploding gradients in deep CNNs, RNNs, and generative architectures. |
| **Layer Regularization** | `SpatialDropout2D(rate)` for feature maps; `Dropout` for dense | Standard `Dropout` applied directly across convolutional feature maps | Standard dropout drops individual independent pixels; `SpatialDropout2D` drops entire 2D feature channels, combating co-adaptation. |
| **GPU Memory Growth** | `tf.config.experimental.set_memory_growth(gpu, True)` | Allowing TensorFlow to allocate 100% of VRAM on startup | Avoids instant Out-Of-Memory (OOM) errors and allows co-existence with other processes or OS display managers. |

---

## Core Patterns: Before & After

### 1. Data Pipeline: Legacy `ImageDataGenerator` vs Modern `tf.data` ETL

#### ❌ Anti-Pattern: Deprecated `ImageDataGenerator`
```python
# DEPRECATED: Executes in Python interpreter, CPU bound, slow disk I/O
from tensorflow.keras.preprocessing.image import ImageDataGenerator

train_datagen = ImageDataGenerator(
    rescale=1.0 / 255.0,
    shear_range=0.2,
    zoom_range=0.2,
    horizontal_flip=True
)
training_set = train_datagen.flow_from_directory(
    'dataset/training_set',
    target_size=(64, 64),
    batch_size=32,
    class_mode='binary'
)
model.fit(training_set, epochs=25)
```

#### ✅ Modern Standard: Vectorized `tf.data` with In-Graph Preprocessing
```python
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers

BATCH_SIZE = 32
IMG_SIZE = (64, 64)

# High-performance asynchronous directory reader
train_ds = keras.utils.image_dataset_from_directory(
    'dataset/training_set',
    image_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
    label_mode='binary',
    shuffle=True
)

# In-graph preprocessing layers execute directly on GPU during training
data_augmentation = keras.Sequential([
    layers.Rescaling(1.0 / 255.0),
    layers.RandomFlip("horizontal"),
    layers.RandomRotation(0.1),
    layers.RandomZoom(0.2),
])

# Optimal pipeline: parallel map + cache + prefetch with AUTOTUNE
AUTOTUNE = tf.data.AUTOTUNE
train_ds = (
    train_ds
    .map(lambda x, y: (data_augmentation(x, training=True), y), num_parallel_calls=AUTOTUNE)
    .cache()
    .prefetch(buffer_size=AUTOTUNE)
)

model.fit(train_ds, epochs=25)
```

---

### 2. Model Architecture: Implicit `input_shape` vs Explicit `keras.Input`

#### ❌ Anti-Pattern: Deprecated `input_shape` in Layer
```python
# Triggers Keras 3 UserWarning: Do not pass an input_shape/input_dim argument to a layer.
cnn = keras.models.Sequential()
cnn.add(layers.Conv2D(32, (3, 3), activation='relu', input_shape=(28, 28, 1)))
cnn.add(layers.Dense(10, activation='softmax'))
```

#### ✅ Modern Standard: Declarative Sequential with Explicit Input
```python
# Sequential with explicit Input layer and linear logits
cnn = keras.models.Sequential([
    layers.Input(shape=(28, 28, 1)),
    layers.Conv2D(32, (3, 3), activation='relu'),
    layers.BatchNormalization(),
    layers.MaxPool2D((2, 2)),
    layers.SpatialDropout2D(0.2),
    layers.Flatten(),
    layers.Dense(128, activation='relu', kernel_regularizer=keras.regularizers.L2(1e-4)),
    layers.Dropout(0.5),
    layers.Dense(10, dtype="float32")  # Explicit float32 for mixed precision safety
])
```

---

### 3. Loss & Logits: Saturated Probabilities vs Numerically Stable Logits

#### ❌ Anti-Pattern: Sigmoid/Softmax in Model with Raw Crossentropy
```python
# Model outputs bounded probabilities [0, 1]
model.add(layers.Dense(1, activation='sigmoid'))

# Prone to vanishing gradients and log(0) numerical underflow
model.compile(
    optimizer='adam',
    loss='binary_crossentropy',
    metrics=['accuracy']
)
```

#### ✅ Modern Standard: Linear Logits with `from_logits=True`
```python
# Output unconstrained real-valued logits (-inf, +inf) with float32 precision
model.add(layers.Dense(1, dtype="float32"))

# Loss computes fused log-sum-exp for exact gradient stability
model.compile(
    optimizer=keras.optimizers.Adam(learning_rate=1e-3, clipnorm=1.0),
    loss=keras.losses.BinaryCrossentropy(from_logits=True),
    metrics=[keras.metrics.BinaryAccuracy(threshold=0.0)]  # Logit threshold is 0.0
)

# For inference / probability extraction:
raw_logits = model.predict(test_ds)
probabilities = tf.sigmoid(raw_logits).numpy()
predictions = (probabilities >= 0.5).astype(int)
```

---

### 4. Custom Architectures: Raw Eager Loop vs Subclassed `keras.Model`

#### ❌ Anti-Pattern: Raw Python Eager Loop Overriding Standard Tooling
```python
# Loses all Keras callbacks, history metrics, validation checks, and tensorboard integration
for epoch in range(epochs):
    for x_batch, y_batch in dataset:
        with tf.GradientTape() as tape:
            y_pred = model(x_batch, training=True)
            loss = loss_fn(y_batch, y_pred)
        grads = tape.gradient(loss, model.trainable_weights)
        optimizer.apply_gradients(zip(grads, model.trainable_weights))
```

#### ✅ Modern Standard: Complete Subclassed `keras.Model` with `call`, `train_step`, and `test_step`
```python
class CustomModel(keras.Model):
    def __init__(self, backbone, **kwargs):
        super().__init__(**kwargs)
        self.backbone = backbone
        self.loss_tracker = keras.metrics.Mean(name="total_loss")

    @property
    def metrics(self):
        # Enables automatic metric reset at the start of each epoch
        return [self.loss_tracker]

    def call(self, inputs, training=False):
        # Forward pass delegation: required for model(x), evaluate(), and validation in fit()
        return self.backbone(inputs, training=training)

    def train_step(self, data):
        if isinstance(data, tuple):
            x, y = data
        else:
            x, y = data, None

        with tf.GradientTape() as tape:
            y_pred = self(x, training=True)
            loss = self.compute_custom_loss(x, y, y_pred)

        grads = tape.gradient(loss, self.trainable_weights)
        self.optimizer.apply_gradients(zip(grads, self.trainable_weights))

        self.loss_tracker.update_state(loss)
        return {m.name: m.result() for m in self.metrics}

    def test_step(self, data):
        # Guarantees that model.evaluate() and validation_data in fit() work seamlessly
        if isinstance(data, tuple):
            x, y = data
        else:
            x, y = data, None

        y_pred = self(x, training=False)
        loss = self.compute_custom_loss(x, y, y_pred)

        self.loss_tracker.update_state(loss)
        return {m.name: m.result() for m in self.metrics}

# Fully compatible with standard fit(), validation, callbacks, and evaluate()
model = CustomModel(backbone)
model.compile(optimizer=keras.optimizers.Adam())
model.fit(train_ds, validation_data=val_ds, epochs=20, callbacks=[...])
```

---

## Implementation Recipes

### 1. Tabular ANN Classification & Single-Sample Prediction
Synthesized from `Machine-Learning-Course-Lab-main` (e.g. customer churn prediction with numeric and one-hot encoded features).

```python
import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers

def build_tabular_classifier(num_features: int) -> keras.Model:
    """Production tabular MLP with batch normalization, dropout, and linear logits."""
    model = keras.Sequential([
        layers.Input(shape=(num_features,)),
        layers.Dense(64, activation="relu"),
        layers.BatchNormalization(),
        layers.Dropout(0.3),
        layers.Dense(32, activation="relu"),
        layers.BatchNormalization(),
        layers.Dropout(0.2),
        layers.Dense(1, dtype="float32")  # Output linear logit with explicit float32
    ], name="tabular_ann")

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=1e-3),
        loss=keras.losses.BinaryCrossentropy(from_logits=True),
        metrics=[keras.metrics.BinaryAccuracy(name="accuracy", threshold=0.0)]
    )
    return model

# Train with validation split and early stopping
# Features X_train should be preprocessed (e.g. via StandardScaler or ColumnTransformer)
model = build_tabular_classifier(num_features=12)
# history = model.fit(
#     X_train, y_train,
#     validation_split=0.2,
#     epochs=50,
#     batch_size=32,
#     callbacks=[keras.callbacks.EarlyStopping(monitor="val_loss", patience=5, restore_best_weights=True)]
# )

def predict_single_sample(model: keras.Model, feature_vector: list[float], threshold: float = 0.5) -> tuple[float, bool]:
    """Inference on single sample: expects 2D array [[f1, f2, ...]] and applies sigmoid."""
    input_tensor = np.array([feature_vector], dtype=np.float32)
    logits = model(input_tensor, training=False)
    probability = float(tf.sigmoid(logits).numpy()[0, 0])
    prediction = probability >= threshold
    return probability, prediction
```

---

### 2. High-Performance ETL Data Pipeline
Vectorized `tf.data` pipeline avoiding GPU starvation and CPU bottlenecks.

```python
import tensorflow as tf
from tensorflow import keras

def build_optimized_dataset(
    file_paths: list[str],
    labels: list[int],
    batch_size: int = 64,
    is_training: bool = True
) -> tf.data.Dataset:
    """Builds a non-blocking, multi-threaded tf.data pipeline."""
    AUTOTUNE = tf.data.AUTOTUNE

    # Create dataset from memory slices
    dataset = tf.data.Dataset.from_tensor_slices((file_paths, labels))

    if is_training:
        dataset = dataset.shuffle(buffer_size=min(len(file_paths), 10000), seed=42)

    def load_and_preprocess(path: tf.Tensor, label: tf.Tensor):
        img_bytes = tf.io.read_file(path)
        img = tf.io.decode_jpeg(img_bytes, channels=3)
        img = tf.image.resize(img, [128, 128])
        img = tf.cast(img, tf.float32) / 255.0  # Normalize to [0, 1]
        return img, label

    # Deterministic mapping in parallel
    dataset = dataset.map(load_and_preprocess, num_parallel_calls=AUTOTUNE)

    # In-memory cache for fast subsequent epochs
    dataset = dataset.cache()

    # Batching with drop_remainder=True ensures fixed tensor shapes for XLA/jit_compile
    dataset = dataset.batch(batch_size, drop_remainder=is_training)

    # Prefetch overlaps data loading on CPU with computation on GPU
    dataset = dataset.prefetch(buffer_size=AUTOTUNE)

    return dataset
```

---

### 3. Production Computer Vision CNN with Regularization & Callbacks
Synthesized from `deep-convolutional-neural-network-digits-classifier-main` (deep CNN with spatial dropout, batch norm, L2 weight decay, and production callbacks).

```python
import os
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers

def create_regularized_cnn(input_shape=(28, 28, 1), num_classes=10) -> keras.Model:
    """Production-grade deep convolutional network with batchnorm and spatial dropout."""
    model = keras.Sequential([
        layers.Input(shape=input_shape),

        # Conv Block 1
        layers.Conv2D(32, (3, 3), padding="same", activation="relu"),
        layers.BatchNormalization(),
        layers.Conv2D(32, (3, 3), activation="relu"),
        layers.BatchNormalization(),
        layers.MaxPool2D((2, 2)),
        layers.SpatialDropout2D(0.2),

        # Conv Block 2
        layers.Conv2D(64, (3, 3), padding="same", activation="relu"),
        layers.BatchNormalization(),
        layers.Conv2D(64, (3, 3), activation="relu"),
        layers.BatchNormalization(),
        layers.MaxPool2D((2, 2)),
        layers.SpatialDropout2D(0.2),

        # Conv Block 3
        layers.Conv2D(128, (3, 3), padding="same", activation="relu"),
        layers.BatchNormalization(),
        layers.MaxPool2D((2, 2)),
        layers.SpatialDropout2D(0.3),

        # Classification Head
        layers.Flatten(),
        layers.Dense(256, activation="relu", kernel_regularizer=keras.regularizers.L2(1e-4)),
        layers.BatchNormalization(),
        layers.Dropout(0.5),
        layers.Dense(num_classes, dtype="float32")  # Explicit float32 for mixed precision stability
    ])
    return model

model = create_regularized_cnn()
model.compile(
    optimizer=keras.optimizers.Adam(learning_rate=1e-3, clipnorm=1.0),
    loss=keras.losses.SparseCategoricalCrossentropy(from_logits=True),
    metrics=[keras.metrics.SparseCategoricalAccuracy(name="accuracy")]
)

callbacks = [
    keras.callbacks.EarlyStopping(
        monitor="val_loss",
        patience=8,
        restore_best_weights=True,
        verbose=1
    ),
    keras.callbacks.ModelCheckpoint(
        filepath="checkpoints/best_model.keras",  # Modern self-contained .keras format
        monitor="val_accuracy",
        save_best_only=True,
        verbose=1
    ),
    keras.callbacks.ReduceLROnPlateau(
        monitor="val_loss",
        factor=0.2,
        patience=4,
        min_lr=1e-6,
        verbose=1
    ),
    keras.callbacks.TensorBoard(
        log_dir="logs/fit",
        histogram_freq=1
    )
]
```

---

### 4. Generative Variational Autoencoder (VAE) with Custom Layer, `call`, and `test_step`
Synthesized from `Data-Science-Machine-Learning-Lab-main` (Fashion-MNIST VAE with custom reparameterization layer, composite ELBO loss, and full train/validation evaluation support).

```python
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers

@keras.saving.register_keras_serializable(package="custom")
class SamplingLayer(layers.Layer):
    """Reparameterization trick: z = z_mean + exp(0.5 * z_log_var) * epsilon."""
    def call(self, inputs):
        z_mean, z_log_var = inputs
        batch = tf.shape(z_mean)[0]
        dim = tf.shape(z_mean)[1]
        epsilon = tf.random.normal(shape=(batch, dim))
        return z_mean + tf.exp(0.5 * z_log_var) * epsilon

def build_vae_encoder(latent_dim: int = 2) -> keras.Model:
    inputs = layers.Input(shape=(28, 28, 1))
    x = layers.Conv2D(32, 3, strides=2, padding="same", activation="relu")(inputs)
    x = layers.Conv2D(64, 3, strides=2, padding="same", activation="relu")(x)
    x = layers.Flatten()(x)
    x = layers.Dense(128, activation="relu")(x)
    z_mean = layers.Dense(latent_dim, name="z_mean")(x)
    z_log_var = layers.Dense(latent_dim, name="z_log_var")(x)
    z = SamplingLayer()([z_mean, z_log_var])
    return keras.Model(inputs, [z_mean, z_log_var, z], name="encoder")

def build_vae_decoder(latent_dim: int = 2) -> keras.Model:
    latent_inputs = layers.Input(shape=(latent_dim,))
    x = layers.Dense(7 * 7 * 64, activation="relu")(latent_inputs)
    x = layers.Reshape((7, 7, 64))(x)
    x = layers.Conv2DTranspose(64, 3, strides=2, padding="same", activation="relu")(x)
    x = layers.Conv2DTranspose(32, 3, strides=2, padding="same", activation="relu")(x)
    decoder_outputs = layers.Conv2DTranspose(1, 3, padding="same", activation="sigmoid")(x)
    return keras.Model(latent_inputs, decoder_outputs, name="decoder")

class VAE(keras.Model):
    """Full VAE model encapsulating composite ELBO loss with full evaluation support."""
    def __init__(self, encoder: keras.Model, decoder: keras.Model, kl_weight: float = 1.0, **kwargs):
        super().__init__(**kwargs)
        self.encoder = encoder
        self.decoder = decoder
        self.kl_weight = kl_weight
        self.total_loss_tracker = keras.metrics.Mean(name="total_loss")
        self.reconstruction_loss_tracker = keras.metrics.Mean(name="reconstruction_loss")
        self.kl_loss_tracker = keras.metrics.Mean(name="kl_loss")

    @property
    def metrics(self):
        return [self.total_loss_tracker, self.reconstruction_loss_tracker, self.kl_loss_tracker]

    def call(self, inputs, training=False):
        """Forward pass returning the decoded reconstruction."""
        z_mean, z_log_var, z = self.encoder(inputs, training=training)
        return self.decoder(z, training=training)

    def _compute_loss(self, data, training=True):
        z_mean, z_log_var, z = self.encoder(data, training=training)
        reconstruction = self.decoder(z, training=training)

        # Sum reconstruction crossentropy over spatial dimensions (H, W), average over batch
        recon_loss = tf.reduce_mean(
            tf.reduce_sum(
                keras.losses.binary_crossentropy(data, reconstruction),
                axis=(1, 2)
            )
        )
        # Analytical KL divergence: -0.5 * sum(1 + log_var - mu^2 - exp(log_var))
        kl_loss = tf.reduce_mean(
            tf.reduce_sum(
                -0.5 * (1.0 + z_log_var - tf.square(z_mean) - tf.exp(z_log_var)),
                axis=1
            )
        )
        total_loss = recon_loss + self.kl_weight * kl_loss
        return total_loss, recon_loss, kl_loss

    def train_step(self, data):
        if isinstance(data, tuple):
            data = data[0]

        with tf.GradientTape() as tape:
            total_loss, recon_loss, kl_loss = self._compute_loss(data, training=True)

        grads = tape.gradient(total_loss, self.trainable_weights)
        self.optimizer.apply_gradients(zip(grads, self.trainable_weights))

        self.total_loss_tracker.update_state(total_loss)
        self.reconstruction_loss_tracker.update_state(recon_loss)
        self.kl_loss_tracker.update_state(kl_loss)
        return {m.name: m.result() for m in self.metrics}

    def test_step(self, data):
        """Enables model.evaluate() and validation_data in model.fit()."""
        if isinstance(data, tuple):
            data = data[0]

        total_loss, recon_loss, kl_loss = self._compute_loss(data, training=False)

        self.total_loss_tracker.update_state(total_loss)
        self.reconstruction_loss_tracker.update_state(recon_loss)
        self.kl_loss_tracker.update_state(kl_loss)
        return {m.name: m.result() for m in self.metrics}
```

---

### 5. Generative DCGAN as a Subclassed `keras.Model`
Synthesized from `Data-Science-Machine-Learning-Lab-main` (Fashion-MNIST GAN with dual optimizers, label smoothing, and native `model.fit()` integration).

```python
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers

def make_generator(noise_dim: int = 100) -> keras.Model:
    return keras.Sequential([
        layers.Input(shape=(noise_dim,)),
        layers.Dense(7 * 7 * 256, use_bias=False),
        layers.BatchNormalization(),
        layers.LeakyReLU(negative_slope=0.2),
        layers.Reshape((7, 7, 256)),
        layers.Conv2DTranspose(128, 3, strides=2, padding="same", use_bias=False),
        layers.BatchNormalization(),
        layers.LeakyReLU(negative_slope=0.2),
        layers.Conv2DTranspose(64, 3, strides=2, padding="same", use_bias=False),
        layers.BatchNormalization(),
        layers.LeakyReLU(negative_slope=0.2),
        layers.Conv2DTranspose(1, 3, padding="same", activation="tanh")  # Pixel values in [-1, 1]
    ], name="generator")

def make_discriminator() -> keras.Model:
    return keras.Sequential([
        layers.Input(shape=(28, 28, 1)),
        layers.Conv2D(64, 3, strides=2, padding="same"),
        layers.LeakyReLU(negative_slope=0.2),
        layers.Dropout(0.3),
        layers.Conv2D(128, 3, strides=2, padding="same"),
        layers.LeakyReLU(negative_slope=0.2),
        layers.Dropout(0.3),
        layers.Flatten(),
        layers.Dense(1, dtype="float32")  # Output linear logits (from_logits=True)
    ], name="discriminator")

class DCGAN(keras.Model):
    """Subclassed Keras Model integrating adversarial training into standard model.fit()."""
    def __init__(self, discriminator: keras.Model, generator: keras.Model, noise_dim: int = 100, **kwargs):
        super().__init__(**kwargs)
        self.discriminator = discriminator
        self.generator = generator
        self.noise_dim = noise_dim
        self.d_loss_tracker = keras.metrics.Mean(name="d_loss")
        self.g_loss_tracker = keras.metrics.Mean(name="g_loss")

    def compile(self, d_optimizer, g_optimizer, loss_fn=None):
        super().compile()
        self.d_optimizer = d_optimizer
        self.g_optimizer = g_optimizer
        self.loss_fn = loss_fn or keras.losses.BinaryCrossentropy(from_logits=True)

    @property
    def metrics(self):
        return [self.d_loss_tracker, self.g_loss_tracker]

    def call(self, inputs, training=False):
        return self.generator(inputs, training=training)

    def train_step(self, real_images):
        if isinstance(real_images, tuple):
            real_images = real_images[0]
        batch_size = tf.shape(real_images)[0]
        noise = tf.random.normal(shape=(batch_size, self.noise_dim))

        # 1. Train Discriminator: real -> 1 (smoothed to 0.9), fake -> 0
        with tf.GradientTape() as d_tape:
            fake_images = self.generator(noise, training=True)
            real_logits = self.discriminator(real_images, training=True)
            fake_logits = self.discriminator(fake_images, training=True)

            d_loss_real = self.loss_fn(tf.fill([batch_size, 1], 0.9), real_logits)
            d_loss_fake = self.loss_fn(tf.zeros([batch_size, 1]), fake_logits)
            d_loss = d_loss_real + d_loss_fake

        d_grads = d_tape.gradient(d_loss, self.discriminator.trainable_variables)
        self.d_optimizer.apply_gradients(zip(d_grads, self.discriminator.trainable_variables))

        # 2. Train Generator: fool discriminator so fake_logits -> 1
        noise = tf.random.normal(shape=(batch_size, self.noise_dim))
        with tf.GradientTape() as g_tape:
            fake_images = self.generator(noise, training=True)
            fake_logits = self.discriminator(fake_images, training=True)
            g_loss = self.loss_fn(tf.ones([batch_size, 1]), fake_logits)

        g_grads = g_tape.gradient(g_loss, self.generator.trainable_variables)
        self.g_optimizer.apply_gradients(zip(g_grads, self.generator.trainable_variables))

        self.d_loss_tracker.update_state(d_loss)
        self.g_loss_tracker.update_state(g_loss)
        return {m.name: m.result() for m in self.metrics}

# Execution: standard fit() works out of the box
# gan = DCGAN(make_discriminator(), make_generator(), noise_dim=100)
# gan.compile(
#     d_optimizer=keras.optimizers.Adam(learning_rate=2e-4, beta_1=0.5),
#     g_optimizer=keras.optimizers.Adam(learning_rate=1e-4, beta_1=0.5)
# )
# gan.fit(dataset, epochs=30, callbacks=[...])
```

---

### 6. Model Persistence, Serialization, and Verification
Synthesized from `deep-convolutional-neural-network-digits-classifier-main/verify.py` (inspecting shapes, testing `.keras` models, and verifying inference).

```python
import numpy as np
import tensorflow as tf
from tensorflow import keras

def save_and_verify_model(model: keras.Model, filepath: str = "model.keras", test_data: np.ndarray = None):
    """Saves to modern .keras archive and verifies deserialized inference."""
    # 1. Save complete zipped .keras archive (weights, architecture, optimizer state)
    model.save(filepath)

    # 2. Reload with custom objects registered via @keras.saving.register_keras_serializable
    loaded_model = keras.models.load_model(filepath)
    loaded_model.summary()

    # 3. Dynamic input shape inspection (supports both MLP 2D and CNN 4D inputs)
    in_shape = loaded_model.input_shape  # e.g. (None, 28, 28, 1) or (None, 784)
    if test_data is not None:
        if len(in_shape) == 4 and test_data.ndim == 3:
            test_data = np.expand_dims(test_data, axis=-1)
        elif len(in_shape) == 2 and test_data.ndim > 2:
            test_data = test_data.reshape(test_data.shape[0], -1)

        # Batch prediction
        predictions = loaded_model.predict(test_data, batch_size=128)
        return loaded_model, predictions
    return loaded_model
```

---

### 7. Hardware Acceleration: Dynamic GPU Allocation & Distributed Strategy

```python
import tensorflow as tf
from tensorflow import keras

def configure_hardware():
    """Defensive GPU setup preventing OOM crashes on shared hosts."""
    gpus = tf.config.list_physical_devices('GPU')
    if gpus:
        try:
            for gpu in gpus:
                # Enables dynamic memory growth rather than 100% upfront allocation
                tf.config.experimental.set_memory_growth(gpu, True)
            print(f"Configured {len(gpus)} GPU(s) with dynamic memory growth.")
        except RuntimeError as e:
            print(f"GPU configuration error: {e}")

    # Set mixed precision policy for Tensor Core acceleration (FP16 on NVIDIA GPUs)
    # CRITICAL: When mixed precision is enabled, model output layers MUST specify dtype="float32"!
    if gpus:
        keras.mixed_precision.set_global_policy("mixed_float16")
        print("Mixed precision policy set to 'mixed_float16'. Ensure output layer has dtype='float32'.")

def run_distributed_training(create_model_fn, dataset, epochs=10):
    """Multi-GPU Synchronous Data Parallelism."""
    strategy = tf.distribute.MirroredStrategy()
    print(f"Number of devices in MirroredStrategy: {strategy.num_replicas_in_sync}")

    # Everything created inside strategy.scope() is replicated across devices
    with strategy.scope():
        model = create_model_fn()
        model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=1e-3 * strategy.num_replicas_in_sync),
            loss=keras.losses.CategoricalCrossentropy(from_logits=True),
            metrics=["accuracy"],
            jit_compile=True  # Enables XLA kernel fusion
        )

    model.fit(dataset, epochs=epochs)
```

---

## Common Mistakes & Troubleshooting

| Red Flag / Error | Root Cause | Modern Solution |
|---|---|---|
| `UserWarning: Do not pass an input_shape argument to a layer` | Passing `input_shape` inside hidden layers (`Conv2D`, `Dense`) in Keras 3. | Add an explicit `keras.layers.Input(shape=...)` as the very first layer in `Sequential`. |
| `NotImplementedError` or `TypeError: call() missing required argument` on `evaluate()` | Subclassing `keras.Model` and overriding `train_step()` without implementing `call()` or `test_step()`. | Implement `call(self, inputs, training=False)` and `test_step(self, data)` so validation during `fit()` and `evaluate()` compute cleanly. |
| Model loss NaN or Infinity under `mixed_float16` | Missing `dtype="float32"` on the final layer; FP16 logits underflow/overflow during crossentropy computation. | Declare `layers.Dense(num_classes, dtype="float32")` on the final output layer of all classification models. |
| `Cannot deserialize custom layer` when loading `.keras` | Custom layer class was not registered with Keras's serialization registry before saving. | Decorate custom classes with `@keras.saving.register_keras_serializable(package="custom")`. |
| `WARNING:tensorflow:X out of the last X calls triggered tf.function retracing` | Passing Python primitives or varying NumPy array shapes to `@tf.function`. | Pass TensorFlow Tensors (`tf.Tensor`) or specify `input_signature=[tf.TensorSpec(...)]` in `@tf.function`. Ensure batch size is fixed with `drop_remainder=True`. |
| Creating `tf.Variable` inside `@tf.function` | `ValueError: tf.function only supports creating tf.Variable objects on the first call`. | Initialize all layers, weights, and variables *outside* the `@tf.function` decorated step. |
| GPU utilization sits at 10-30% | Data pipeline bottlenecks execution on CPU (un-prefetched disk I/O, synchronous Python loops). | Add `.cache()` and `.prefetch(tf.data.AUTOTUNE)` to the end of the `tf.data.Dataset` pipeline. |
| Model loss NaN or Infinity during FP32 training | Numerical instability in crossentropy with sigmoid/softmax outputs, or exploding gradients. | Output unconstrained logits and use `from_logits=True`. Set `clipnorm=1.0` in the optimizer. |
| `ResourceExhaustedError: OOM when allocating tensor` | Default greedy GPU memory allocator pre-allocates total VRAM or batch size is too large. | Call `tf.config.experimental.set_memory_growth(gpu, True)` at startup; reduce batch size or enable `mixed_float16`. |
| `Cannot load file: unknown layer or format` loading `.h5` | Legacy `.h5` format cannot reliably serialize Keras 3 custom layers, loss configs, or modern weights. | Save and load exclusively using the `.keras` zipped archive format (`model.save("name.keras")`). |
| Custom layer weights not updating | Missing call to `self.add_weight()` or weights not registered as layer attributes. | Instantiate trainable weights in the `build(self, input_shape)` method via `self.add_weight(...)`. |
| Inconsistent evaluation metrics between train and test | Failing to pass `training=False` during evaluation in custom loops. | Explicitly pass `training=False` to `model(x, training=False)` during evaluation and test steps. |

---

## References & Documentation

- [TensorFlow 2 Official Documentation](https://www.tensorflow.org/api_docs/python/tf) — Core TensorFlow ops, tensors, math, distribution strategies, and hardware configuration.
- [Keras 3 Guide & API Documentation](https://keras.io/) — Multi-backend Keras 3 reference, layers, functional/subclassed models, losses, and optimizers.
- [tf.data: Build TensorFlow input pipelines](https://www.tensorflow.org/guide/data) — High-throughput ETL best practices, performance tuning, and AUTOTUNE.
- [Better performance with tf.function](https://www.tensorflow.org/guide/function) — Computation graph tracing, polymorphic execution, and retracing mitigation.
- [Distributed training with TensorFlow](https://www.tensorflow.org/guide/distributed_training) — Multi-GPU `MirroredStrategy`, TPU strategies, and parameter server architectures.
- [Keras Mixed Precision Guide](https://www.tensorflow.org/guide/mixed_precision) — FP16 / BF16 mixed precision policies, loss scaling mechanics, and float32 output layer requirements.
- [Keras Serialization & Saving](https://keras.io/guides/serialization_and_saving/) — Native `.keras` zip archive structure and `@keras.saving.register_keras_serializable` registration.
