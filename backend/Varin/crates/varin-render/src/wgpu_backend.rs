use anyhow::{anyhow, Context, Result};
use bytemuck::{Pod, Zeroable};
use std::sync::OnceLock;
use varin_core::{Primitive, Scene};
use wgpu::util::DeviceExt;

static WGPU_CTX: OnceLock<WgpuContext> = OnceLock::new();

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
struct Vertex {
    pos: [f32; 2],
    color: [f32; 4],
}

struct WgpuContext {
    device: wgpu::Device,
    queue: wgpu::Queue,
}

impl WgpuContext {
    fn get() -> Result<&'static WgpuContext> {
        if let Some(ctx) = WGPU_CTX.get() {
            return Ok(ctx);
        }
        let instance = wgpu::Instance::default();
        let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions {
            power_preference: wgpu::PowerPreference::HighPerformance,
            force_fallback_adapter: false,
            compatible_surface: None,
        }))
        .context("no compatible GPU adapter found for wgpu backend")?;
        let (device, queue) = pollster::block_on(adapter.request_device(&wgpu::DeviceDescriptor {
            required_features: wgpu::Features::empty(),
            required_limits: wgpu::Limits::default(),
            label: Some("varin-wgpu-device"),
            memory_hints: wgpu::MemoryHints::Performance,
        }, None))
        .context("failed creating wgpu device/queue")?;
        let _ = WGPU_CTX.set(WgpuContext { device, queue });
        WGPU_CTX
            .get()
            .ok_or_else(|| anyhow!("failed initializing wgpu context"))
    }
}

pub fn render_frame_wgpu(scene: &Scene, t: f32, width: u32, height: u32) -> Result<Vec<u8>> {
    let ctx = WgpuContext::get()?;
    let layers = scene.resolve_at(t);
    let bg = scene.canvas.background_rgba;
    let tex = ctx.device.create_texture(&wgpu::TextureDescriptor {
        label: Some("varin-wgpu-frame"),
        size: wgpu::Extent3d {
            width,
            height,
            depth_or_array_layers: 1,
        },
        mip_level_count: 1,
        sample_count: 1,
        dimension: wgpu::TextureDimension::D2,
        format: wgpu::TextureFormat::Rgba8Unorm,
        usage: wgpu::TextureUsages::RENDER_ATTACHMENT | wgpu::TextureUsages::COPY_SRC,
        view_formats: &[],
    });
    let view = tex.create_view(&wgpu::TextureViewDescriptor::default());

    let shader = ctx
        .device
        .create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("varin-wgpu-shader"),
            source: wgpu::ShaderSource::Wgsl(
                "
struct VSOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) color: vec4<f32>,
};

@vertex
fn vs_main(@location(0) in_pos: vec2<f32>, @location(1) in_color: vec4<f32>) -> VSOut {
  var out: VSOut;
  out.pos = vec4<f32>(in_pos, 0.0, 1.0);
  out.color = in_color;
  return out;
}

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  return in.color;
}
"
                .into(),
            ),
        });

    let pipeline_layout = ctx
        .device
        .create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("varin-wgpu-pipeline-layout"),
            bind_group_layouts: &[],
            push_constant_ranges: &[],
        });
    let pipeline = ctx
        .device
        .create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("varin-wgpu-pipeline"),
            layout: Some(&pipeline_layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: Some("vs_main"),
                compilation_options: wgpu::PipelineCompilationOptions::default(),
                buffers: &[wgpu::VertexBufferLayout {
                    array_stride: std::mem::size_of::<Vertex>() as u64,
                    step_mode: wgpu::VertexStepMode::Vertex,
                    attributes: &wgpu::vertex_attr_array![0=>Float32x2, 1=>Float32x4],
                }],
            },
            fragment: Some(wgpu::FragmentState {
                module: &shader,
                entry_point: Some("fs_main"),
                compilation_options: wgpu::PipelineCompilationOptions::default(),
                targets: &[Some(wgpu::ColorTargetState {
                    format: wgpu::TextureFormat::Rgba8Unorm,
                    blend: Some(wgpu::BlendState::ALPHA_BLENDING),
                    write_mask: wgpu::ColorWrites::ALL,
                })],
            }),
            primitive: wgpu::PrimitiveState::default(),
            depth_stencil: None,
            multisample: wgpu::MultisampleState::default(),
            multiview: None,
            cache: None,
        });

    let mut verts: Vec<Vertex> = Vec::new();
    for layer in layers {
        let alpha = (layer.style.fill_rgba[3] as f32 / 255.0) * layer.style.opacity.clamp(0.0, 1.0);
        let color = [
            layer.style.fill_rgba[0] as f32 / 255.0,
            layer.style.fill_rgba[1] as f32 / 255.0,
            layer.style.fill_rgba[2] as f32 / 255.0,
            alpha.clamp(0.0, 1.0),
        ];
        match layer.primitive {
            Primitive::Rect { width: w, height: h, .. } => {
                push_quad(&mut verts, width, height, layer.transform.x, layer.transform.y, w, h, color);
            }
            Primitive::Circle { radius } => {
                push_quad(
                    &mut verts,
                    width,
                    height,
                    layer.transform.x,
                    layer.transform.y,
                    radius * 2.0,
                    radius * 2.0,
                    color,
                );
            }
            Primitive::Ellipse { radius_x, radius_y } => {
                push_quad(
                    &mut verts,
                    width,
                    height,
                    layer.transform.x,
                    layer.transform.y,
                    radius_x * 2.0,
                    radius_y * 2.0,
                    color,
                );
            }
            Primitive::Cube { size, .. } => {
                push_quad(
                    &mut verts,
                    width,
                    height,
                    layer.transform.x,
                    layer.transform.y,
                    size,
                    size,
                    color,
                );
            }
            Primitive::Cuboid { width: w, height: h, .. } => {
                push_quad(&mut verts, width, height, layer.transform.x, layer.transform.y, w, h, color);
            }
            _ => {}
        }
    }

    let vbuf = ctx
        .device
        .create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("varin-wgpu-verts"),
            contents: bytemuck::cast_slice(&verts),
            usage: wgpu::BufferUsages::VERTEX,
        });

    let mut encoder = ctx
        .device
        .create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("varin-wgpu-encoder"),
        });
    {
        let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: Some("varin-wgpu-pass"),
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view: &view,
                resolve_target: None,
                ops: wgpu::Operations {
                    load: wgpu::LoadOp::Clear(wgpu::Color {
                        r: bg[0] as f64 / 255.0,
                        g: bg[1] as f64 / 255.0,
                        b: bg[2] as f64 / 255.0,
                        a: bg[3] as f64 / 255.0,
                    }),
                    store: wgpu::StoreOp::Store,
                },
            })],
            depth_stencil_attachment: None,
            timestamp_writes: None,
            occlusion_query_set: None,
        });
        if !verts.is_empty() {
            pass.set_pipeline(&pipeline);
            pass.set_vertex_buffer(0, vbuf.slice(..));
            pass.draw(0..verts.len() as u32, 0..1);
        }
    }

    let bytes_per_pixel = 4u32;
    let unpadded_bpr = width * bytes_per_pixel;
    let align = wgpu::COPY_BYTES_PER_ROW_ALIGNMENT;
    let padded_bpr = unpadded_bpr.div_ceil(align) * align;
    let out_size = (padded_bpr * height) as u64;
    let out_buf = ctx.device.create_buffer(&wgpu::BufferDescriptor {
        label: Some("varin-wgpu-readback"),
        size: out_size,
        usage: wgpu::BufferUsages::COPY_DST | wgpu::BufferUsages::MAP_READ,
        mapped_at_creation: false,
    });
    encoder.copy_texture_to_buffer(
        tex.as_image_copy(),
        wgpu::TexelCopyBufferInfo {
            buffer: &out_buf,
            layout: wgpu::TexelCopyBufferLayout {
                offset: 0,
                bytes_per_row: Some(padded_bpr),
                rows_per_image: Some(height),
            },
        },
        wgpu::Extent3d {
            width,
            height,
            depth_or_array_layers: 1,
        },
    );
    ctx.queue.submit(Some(encoder.finish()));

    let slice = out_buf.slice(..);
    let (tx, rx) = std::sync::mpsc::channel();
    slice.map_async(wgpu::MapMode::Read, move |v| {
        let _ = tx.send(v);
    });
    let _ = ctx.device.poll(wgpu::Maintain::Wait);
    rx.recv()
        .context("wgpu readback channel failed")?
        .context("wgpu map_async failed")?;

    let mapped = slice.get_mapped_range();
    let mut out = vec![0u8; (unpadded_bpr * height) as usize];
    for row in 0..height as usize {
        let src_off = row * padded_bpr as usize;
        let dst_off = row * unpadded_bpr as usize;
        out[dst_off..dst_off + unpadded_bpr as usize]
            .copy_from_slice(&mapped[src_off..src_off + unpadded_bpr as usize]);
    }
    drop(mapped);
    out_buf.unmap();
    Ok(out)
}

fn push_quad(
    out: &mut Vec<Vertex>,
    width: u32,
    height: u32,
    cx: f32,
    cy: f32,
    w: f32,
    h: f32,
    color: [f32; 4],
) {
    let hw = w * 0.5;
    let hh = h * 0.5;
    let p1 = to_ndc(width, height, cx - hw, cy - hh);
    let p2 = to_ndc(width, height, cx + hw, cy - hh);
    let p3 = to_ndc(width, height, cx + hw, cy + hh);
    let p4 = to_ndc(width, height, cx - hw, cy + hh);
    out.push(Vertex { pos: p1, color });
    out.push(Vertex { pos: p2, color });
    out.push(Vertex { pos: p3, color });
    out.push(Vertex { pos: p1, color });
    out.push(Vertex { pos: p3, color });
    out.push(Vertex { pos: p4, color });
}

fn to_ndc(width: u32, height: u32, x: f32, y: f32) -> [f32; 2] {
    let nx = (x / width as f32) * 2.0 - 1.0;
    let ny = 1.0 - (y / height as f32) * 2.0;
    [nx, ny]
}
